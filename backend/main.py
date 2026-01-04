from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

# Import routers
from backend.routers import transcribe, system

app = FastAPI(title="WhisperX-Studio API")

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
from backend.routers import toolbox
app.include_router(toolbox.router, prefix="/api/toolbox", tags=["Toolbox"])

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
