from fastapi import APIRouter
import torch
import shutil
import os

router = APIRouter()

@router.get("/status")
async def get_system_status():
    gpu_info = {"available": False, "name": "CPU", "vram_total": 0, "vram_free": 0}
    
    if torch.cuda.is_available():
        props = torch.cuda.get_device_properties(0)
        # Simple VRAM check (approximate)
        free, total = torch.cuda.mem_get_info()
        gpu_info = {
            "available": True,
            "name": torch.cuda.get_device_name(0),
            "vram_total": round(total / 1024**3, 2),
            "vram_free": round(free / 1024**3, 2)
        }
        
    storage_path = os.environ.get("UMS_STORAGE", "/tmp")
    disk_usage = shutil.disk_usage(storage_path)
    
    return {
        "gpu": gpu_info,
        "storage": {
            "path": storage_path,
            "free_gb": round(disk_usage.free / 1024**3, 2)
        }
    }
