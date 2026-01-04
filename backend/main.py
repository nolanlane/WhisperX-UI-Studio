from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import time
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Import routers
from backend.routers import transcribe, system, toolbox

logger = logging.getLogger("Main")

async def cleanup_task():
    """Periodically clean up old files."""
    while True:
        try:
            logger.info("Running cleanup task...")
            storage_path = Path(os.environ.get("UMS_STORAGE", "/tmp"))
            temp_dir = storage_path / "temp"
            output_dir = storage_path / "output"

            now = time.time()
            max_age = 24 * 3600  # 24 hours

            for d in [temp_dir, output_dir]:
                if d.exists():
                    for f in d.iterdir():
                        if f.is_file():
                            if now - f.stat().st_mtime > max_age:
                                try:
                                    f.unlink()
                                    logger.info(f"Deleted old file: {f}")
                                except Exception as e:
                                    logger.warning(f"Failed to delete {f}: {e}")

        except Exception as e:
            logger.error(f"Cleanup task error: {e}")

        await asyncio.sleep(3600)  # Run every hour

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up worker and cleanup tasks...")
    worker_task = asyncio.create_task(transcribe.process_queue())
    cleaner_task = asyncio.create_task(cleanup_task())
    yield
    # Shutdown (optional: cancel tasks)
    logger.info("Shutting down...")
    worker_task.cancel()
    cleaner_task.cancel()

app = FastAPI(title="WhisperX-Studio API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Tighten for production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(transcribe.router, prefix="/api/transcribe", tags=["Transcription"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(toolbox.router, prefix="/api/toolbox", tags=["Toolbox"])

# Mount Frontend (Static Files)
frontend_path = Path("/app/frontend/dist")
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    pass

@app.get("/health")
async def health_check():
    return {"status": "ok"}
