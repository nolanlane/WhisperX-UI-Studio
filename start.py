#!/usr/bin/env python3
"""
WhisperX-Studio Startup Script
- checks hardware (GPU/NVENC)
- ensures storage directories exist
- launches Uvicorn server
"""

import os
import sys
import shutil
import logging
import subprocess
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Startup")

def check_gpu():
    try:
        import torch
        if torch.cuda.is_available():
            vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
            logger.info(f"✅ GPU Detected: {torch.cuda.get_device_name(0)} ({vram:.2f} GB VRAM)")
            return True
        else:
            logger.warning("⚠️ No GPU detected! WhisperX will run VERY slowly on CPU.")
            return False
    except ImportError:
        logger.error("❌ Torch not installed. Cannot check GPU.")
        return False

def check_ffmpeg():
    try:
        res = subprocess.run(["ffmpeg", "-encoders"], capture_output=True, text=True)
        if "h264_nvenc" in res.stdout:
            logger.info("✅ FFmpeg NVENC supported.")
        else:
            logger.info("ℹ️ FFmpeg installed, but NVENC not found (CPU encoding only).")
    except FileNotFoundError:
        logger.error("❌ FFmpeg not found in PATH!")

def setup_storage():
    """Ensure persistent storage and temp dirs exist."""
    # Vast.ai usually mounts /workspace or we use env var
    storage_root = Path(os.environ.get("UMS_STORAGE", "/workspace"))
    if not storage_root.exists():
        storage_root = Path("/app/data") # Fallback
    
    dirs = [
        storage_root / "output",
        storage_root / "temp",
        storage_root / "models",
    ]
    
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)
        logger.info(f"📁 Verified directory: {d}")
    
    # Set env vars for app to use
    os.environ["UMS_STORAGE"] = str(storage_root)
    os.environ["HF_HOME"] = str(storage_root / "models" / "huggingface")

def start_server():
    logger.info("🚀 Launching WhisperX-Studio Backend...")
    # Using subprocess to run uvicorn to allow for potential restart logic if needed later
    # and to keep main process alive
    cmd = [
        "uvicorn",
        "backend.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--workers", "1" # Single worker for GPU safety
    ]
    
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user.")
    except Exception as e:
        logger.error(f"❌ Server crashed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    logger.info("Initializing WhisperX-Studio...")
    check_gpu()
    check_ffmpeg()
    setup_storage()
    start_server()
