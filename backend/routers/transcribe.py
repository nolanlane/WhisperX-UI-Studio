from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect
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

@router.post("/transcribe")
async def upload_file(
    file: UploadFile,
    model_size: str = "large-v3",
    batch_size: int = 16,
    language: str = "auto",
    diarize: bool = False,
    hf_token: str = ""
):
    """Upload file and add to queue for processing"""
    task_id = str(uuid.uuid4())
    storage_dir = Path(os.environ.get("UMS_STORAGE", "/tmp")) / "temp"
    storage_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = storage_dir / f"{task_id}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Enqueue task for processing
    task_data = {
        "task_id": task_id,
        "file_path": str(file_path),
        "model_size": model_size,
        "batch_size": batch_size,
        "language": language,
        "diarize": diarize,
        "hf_token": hf_token,
        "filename": file.filename
    }
    
    # Import here to avoid circular dependency
    from backend.main import task_queue
    await task_queue.enqueue(task_data)
    
    return {"task_id": task_id, "filename": file.filename, "status": "queued"}

async def process_queued_task(task_data: dict):
    """Process a queued task with progress updates"""
    task_id = task_data["task_id"]
    file_path = task_data["file_path"]
    model_size = task_data["model_size"]
    batch_size = task_data.get("batch_size", 16)
    language = task_data["language"]
    diarize = task_data["diarize"]
    hf_token = task_data["hf_token"]
    
    try:
        await notify_client(task_id, {"status": "starting", "progress": 0})
        
        # Define a callback for the inner extraction logic to post updates
        def progress_callback(stage, percent, msg):
            # This needs to be async-safe or scheduled back to loop
            loop = asyncio.get_running_loop()
            asyncio.run_coroutine_threadsafe(
                notify_client(task_id, {"status": stage, "progress": percent, "message": msg}),
                loop
            )

        # Run heavy processing in threadpool to not block async event loop
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None, 
            process_transcription, 
            file_path, model_size, batch_size, language, diarize, hf_token, progress_callback
        )
        
        await notify_client(task_id, {"status": "completed", "progress": 100, "result": result})
        
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        await notify_client(task_id, {"status": "error", "error": str(e)})

@router.websocket("/ws/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    active_connections[task_id] = websocket
    logger.info(f"WebSocket connected for task {task_id}")
    
    try:
        while True:
            # Wait for message or timeout (heartbeat check every 30 seconds)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Respond to ping with pong
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send heartbeat to client
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except Exception:
                    # Client disconnected
                    break
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for task {task_id}")
    except Exception as e:
        logger.error(f"WebSocket error for task {task_id}: {e}")
    finally:
        if task_id in active_connections:
            del active_connections[task_id]
        logger.info(f"WebSocket cleaned up for task {task_id}")

async def notify_client(task_id: str, data: dict):
    if task_id in active_connections:
        try:
            await active_connections[task_id].send_json(data)
        except Exception:
            pass # Connection likely dropped
