from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path
import logging

# Import routers
from backend.routers import transcribe, system
from backend.core.queue import TaskQueue
from backend.core.cleanup import CleanupScheduler

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WhisperX-Studio")

app = FastAPI(title="WhisperX-Studio API")

# Initialize queue and cleanup systems
task_queue = TaskQueue(max_queue_size=10)
cleanup_scheduler = CleanupScheduler()

@app.on_event("startup")
async def startup_event():
    """Initialize background systems on startup"""
    # Start cleanup scheduler
    await cleanup_scheduler.start()
    logger.info("Cleanup scheduler started")
    
    # Start task queue worker
    await task_queue.start(transcribe.process_queued_task)
    logger.info("Task queue worker started")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await task_queue.stop()
    await cleanup_scheduler.stop()
    logger.info("Background systems stopped")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tighten for production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(transcribe.router, prefix="/api", tags=["Transcription"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
from backend.routers import toolbox
app.include_router(toolbox.router, prefix="/api/toolbox", tags=["Toolbox"])

# File download endpoint
from fastapi.responses import FileResponse
from pathlib import Path
import os

@app.get("/api/files/{filename}")
async def download_file(filename: str):
    """Download output files (transcripts, converted videos, etc.)"""
    storage_dir = Path(os.environ.get("UMS_STORAGE", "/tmp")) / "output"
    file_path = storage_dir / filename
    
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path, filename=filename)
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")

# Mount Frontend (Static Files)
# In development, we might reverse proxy, but for the single-container execution:
frontend_path = Path("/app/frontend/dist")
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    # Fallback for local dev without built frontend
    pass

@app.get("/health")
async def health_check():
    return {"status": "ok"}
