from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
import subprocess
import os
from pathlib import Path
import shutil
import uuid

router = APIRouter()

def get_storage_path():
    path = Path(os.environ.get("UMS_STORAGE", "/tmp")) / "output"
    path.mkdir(parents=True, exist_ok=True)
    return path

@router.post("/convert")
async def convert_video(file: UploadFile = File(...), format: str = "mp4", codec: str = "libx264"):
    task_id = str(uuid.uuid4())
    temp_dir = Path(os.environ.get("UMS_STORAGE", "/tmp")) / "temp"
    output_dir = get_storage_path()
    
    input_path = temp_dir / f"{task_id}_{file.filename}"
    output_path = output_dir / f"{Path(file.filename).stem}_converted.{format}"
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Simple synchronous execution (for MVP solidity, ideally background task or async)
    # Using NVENC if available (simplified logic)
    cmd = ["ffmpeg", "-y", "-i", str(input_path)]
    
    if "nvenc" in codec:
        cmd.extend(["-c:v", "h264_nvenc", "-preset", "p4"])
    else:
        cmd.extend(["-c:v", "libx264", "-crf", "23"])
        
    cmd.append(str(output_path))
    
    subprocess.run(cmd, check=True)
    
    return FileResponse(output_path, filename=output_path.name)

@router.post("/burn_subtitles")
async def burn_subtitles(video: UploadFile = File(...), subtitle: UploadFile = File(...)):
    task_id = str(uuid.uuid4())
    temp_dir = Path(os.environ.get("UMS_STORAGE", "/tmp")) / "temp"
    output_dir = get_storage_path()
    
    video_path = temp_dir / f"{task_id}_{video.filename}"
    sub_path = temp_dir / f"{task_id}_{subtitle.filename}"
    output_path = output_dir / f"{Path(video.filename).stem}_burned.mp4"
    
    # Save inputs
    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)
    with open(sub_path, "wb") as f:
        shutil.copyfileobj(subtitle.file, f)
        
    # FFmpeg command
    # subprocess.run handles argument escaping for us mostly, but complex filters need care
    # We use a simple filter for hard subs
    # Note: subtitle path in filter usually needs to be absolute and escaped for ffmpeg
    sub_path_abs = str(sub_path.absolute()).replace(":", "\\:")
    vf_filter = f"subtitles='{sub_path_abs}':force_style='FontSize=24'"
    
    cmd = [
        "ffmpeg", "-y", 
        "-i", str(video_path),
        "-vf", vf_filter,
        "-c:v", "libx264", "-crf", "23",
        "-c:a", "copy",
        str(output_path)
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return FileResponse(output_path, filename=output_path.name)
    except subprocess.CalledProcessError as e:
        return {"error": "FFmpeg failed", "details": e.stderr.decode() if e.stderr else str(e)}
