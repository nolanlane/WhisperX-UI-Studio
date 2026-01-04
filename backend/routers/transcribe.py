from fastapi import APIRouter, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import shutil
import uuid
import os
from pathlib import Path
import asyncio
import logging
from typing import Dict

from backend.core.audio import process_transcription

router = APIRouter()
logger = logging.getLogger("TranscribeRouter")

# Store active web socket connections for task updates
# Map task_id -> WebSocket
active_connections: Dict[str, WebSocket] = {}

@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model_size: str = "large-v3",
    language: str = "auto",
    diarize: bool = False,
    hf_token: str = ""
):
    task_id = str(uuid.uuid4())
    storage_dir = Path(os.environ.get("UMS_STORAGE", "/tmp")) / "temp"
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = storage_dir / f"{task_id}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Queue the processing task
    background_tasks.add_task(
        run_transcription_task, 
        task_id, 
        str(file_path), 
        model_size, 
        language, 
        diarize, 
        hf_token
    )
    
    return {"task_id": task_id, "filename": file.filename, "status": "queued"}

async def run_transcription_task(task_id, file_path, model_size, language, diarize, hf_token):
    """Wrapper to run the sync/heavy processing with progress updates."""
    try:
        await notify_client(task_id, {"status": "starting", "progress": 0})
        
        # We need to run the heavy ML code in a threadpool to not block the async event loop
        # For now, simplistic direct call (beware blocking!) or `run_in_executor`
        # Using run_in_executor is better for heavy lifting
        loop = asyncio.get_running_loop()
        
        # Define a callback for the inner extraction logic to post updates
        def progress_callback(stage, percent, msg):
            # This needs to be async-safe or scheduled back to loop
            asyncio.run_coroutine_threadsafe(
                notify_client(task_id, {"status": stage, "progress": percent, "message": msg}),
                loop
            )

        result = await loop.run_in_executor(
            None, 
            process_transcription, 
            file_path, model_size, language, diarize, hf_token, progress_callback
        )
        
        await notify_client(task_id, {"status": "completed", "progress": 100, "result": result})
        
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        await notify_client(task_id, {"status": "error", "error": str(e)})

@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    active_connections[task_id] = websocket
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        del active_connections[task_id]

async def notify_client(task_id: str, data: dict):
    if task_id in active_connections:
        try:
            await active_connections[task_id].send_json(data)
        except Exception:
            pass # Connection likely dropped
