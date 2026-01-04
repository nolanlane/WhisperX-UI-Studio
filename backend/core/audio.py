import whisperx
import gc
import torch
import logging
from pathlib import Path
import os
import json

logger = logging.getLogger("AudioCore")

def get_device():
    return "cuda" if torch.cuda.is_available() else "cpu"

def flush_vram():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

def process_transcription(file_path: str, model_size: str, language: str, diarize: bool, hf_token: str, progress_callback):
    """
    Core synchronized logic for WhisperX.
    progress_callback(stage_str, percent_int, message_str)
    """
    device = get_device()
    compute_type = "float16" if device == "cuda" else "int8"
    
    progress_callback("loading_model", 10, f"Loading Whisper {model_size}...")
    
    try:
        # Load Model
        model = whisperx.load_model(model_size, device, compute_type=compute_type)
        
        # Transcribe
        progress_callback("transcribing", 30, "Transcribing audio...")
        audio = whisperx.load_audio(file_path)
        result = model.transcribe(audio, batch_size=16, language=None if language == "auto" else language)
        
        # Cleanup Model
        del model
        flush_vram()
        
        # Align
        progress_callback("aligning", 60, "Aligning timestamps...")
        model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
        result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)
        
        del model_a
        flush_vram()
        
        # Diarize
        if diarize and hf_token:
            progress_callback("diarizing", 80, "Diarizing speakers...")
            diarize_model = whisperx.DiarizationPipeline(use_auth_token=hf_token, device=device)
            diarize_segments = diarize_model(audio)
            result = whisperx.assign_word_speakers(diarize_segments, result)
            del diarize_model
            flush_vram()
            
        progress_callback("saving", 90, "Saving results...")
        
        # Format output
        # Return simplified struct for UI
        segments = []
        for seg in result["segments"]:
            segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip(),
                "speaker": seg.get("speaker", "Unknown")
            })
            
        return {"segments": segments, "detected_language": result["language"]}

    except Exception as e:
        logger.error(f"Processing failed: {e}")
        flush_vram()
        raise e
