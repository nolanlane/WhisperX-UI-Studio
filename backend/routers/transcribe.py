from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import shutil
import uuid
import os
from pathlib import Path
import asyncio
import logging
from typing import Dict, Optional

from backend.core.audio import process_transcription

router = APIRouter()
logger = logging.getLogger("TranscribeRouter")

# Global State
active_connections: Dict[str, WebSocket] = {}
transcription_queue: Optional[asyncio.Queue] = None

async def get_queue() -> asyncio.Queue:
    """Ensure queue is initialized in the current loop."""
    global transcription_queue
    if transcription_queue is None:
        transcription_queue = asyncio.Queue()
    return transcription_queue

@router.post("/upload")
async def upload_file(
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
        
    # Add to Queue
    q = await get_queue()
    await q.put({
        "task_id": task_id,
        "file_path": str(file_path),
        "model_size": model_size,
        "language": language,
        "diarize": diarize,
        "hf_token": hf_token
    })

    logger.info(f"Task {task_id} queued. Queue size: {q.qsize()}")
    
    return {"task_id": task_id, "filename": file.filename, "status": "queued"}

async def process_queue():
    """Background worker to process tasks sequentially."""
    logger.info("🚀 Transcription Worker Started")
    q = await get_queue()

    while True:
        task_data = await q.get()
        task_id = task_data["task_id"]

        try:
            logger.info(f"Processing task {task_id}...")
            await notify_client(task_id, {"status": "starting", "progress": 0, "message": "Starting processing..."})

            await run_transcription_task(**task_data)

        except Exception as e:
            logger.error(f"Worker failed task {task_id}: {e}")
            await notify_client(task_id, {"status": "error", "error": str(e)})
        finally:
            q.task_done()

async def run_transcription_task(task_id, file_path, model_size, language, diarize, hf_token):
    """Wrapper to run the sync/heavy processing with progress updates."""
    try:
        # Get running loop to schedule callbacks
        loop = asyncio.get_running_loop()
        
        # Define a callback for the inner extraction logic to post updates
        def progress_callback(stage, percent, msg):
            asyncio.run_coroutine_threadsafe(
                notify_client(task_id, {"status": stage, "progress": percent, "message": msg}),
                loop
            )

        # Run heavy ML code in executor
        result = await loop.run_in_executor(
            None, 
            process_transcription, 
            file_path, model_size, language, diarize, hf_token, progress_callback
        )
        
        await notify_client(task_id, {"status": "completed", "progress": 100, "result": result})
        
    except Exception as e:
        # Re-raise to be caught by worker loop
        raise e

@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    active_connections[task_id] = websocket

    # If the task is currently processing (or queued), the client will get updates.
    # We could send an initial status here if we tracked task state more persistently.
    # For now, just confirming connection.
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        if task_id in active_connections:
            del active_connections[task_id]

async def notify_client(task_id: str, data: dict):
    if task_id in active_connections:
        try:
            await active_connections[task_id].send_json(data)
        except Exception as e:
            logger.warning(f"Failed to send update to {task_id}: {e}")
