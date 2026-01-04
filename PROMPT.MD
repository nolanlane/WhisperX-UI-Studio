# Project Specification: WhisperX-Studio (React + FastAPI)

You are a Principal Software Architect. Your task is to rebuild the current "WhisperX-UI" application into a modern, lightweight, and professional media processing platform called **WhisperX-Studio**.

The goal is to replace the bulky Gradio interface with a decoupled architecture: a high-performance **FastAPI** backend and a sleek, intuitive **React** frontend. The application must be deployment-ready for GPU providers like **Vast.ai**.

---

## 1. Technology Stack

### Backend (Python)
- **Framework**: FastAPI (Async, Type-safe)
- **Server**: Uvicorn (ASGI)
- **Core AI**: WhisperX (v3.7.4+), CTranslate2, Faster-Whisper
- **Media**: FFmpeg (via subprocess with NVENC support)
- **Communication**: WebSockets (for real-time progress bars and terminal-like logs)

### Frontend (TypeScript)
- **Framework**: React 19 (via Vite)
- **Styling**: TailwindCSS v4
- **Components**: Shadcn/UI (Radix Primitives) + Lucide Icons
- **State Management**: TanStack Query (React Query) + Zustand
- **Visuals**: Framer Motion (micro-interactions)

### Deployment (Docker)
- **Image**: NVIDIA CUDA 12.8 base
- **Orchestration**: Single-container deployment (FastAPI serving React static build)
- **Storage**: Dynamic volume mapping (Vast.ai compatibility)

---

## 2. Core Features & UX Requirements

### User Experience (Top Priority)
- **Zero-Config Start**: The app must auto-detect GPU/Encoding capabilities on launch.
- **Drag & Drop**: Massive drop zones for audio/video files with instant validation.
- **Real-Time Feedback**:
    - **WebSocket Progress**: Don't just show a spinner. Show "Transcribing: 45%", "Aligning...", "Diarizing...".
    - **VRAM Monitor**: (Optional) Live GPU memory usage indicator.
- **Dark Mode First**: A premium, "studio" aesthetic (Zinc/Slate palettes, subtle borders).

### Functional Modules
1.  **Transcription Studio**:
    -   Settings: Model Size, Batch Size, Language, Diarization (HF Token).
    -   Output: Live transcript editor, export to SRT/VTT/ASS/TXT.
2.  **Media Toolbox**:
    -   Burn Subtitles (Font size/style preview).
    -   Convert Video (NVENC/CPU toggle).
    -   Extract Audio.

---

## 3. Architecture & API Design

### Endpoints
- `GET /api/system/status`: GPU model, VRAM, FFmpeg status.
- `POST /api/transcribe`: Upload file -> Returns Task ID.
- `WS /api/ws/{task_id}`: Stream progress updates (percentage, current stage, logs).
- `GET /api/files/{filename}`: Download results.

### Safety Mechanisms
- **Queue System**: Internal `asyncio.Queue` to prevent OOM (Out of Memory) by processing one heavy task at a time.
- **VRAM Flushing**: Aggressive garbage collection between pipeline stages (Transcribe -> Align -> Diarize).
- **Auto-Cleanup**: Background scheduler to delete files older than 24h.

---

## 4. Deployment Strategy (Vast.ai)

The system must run as a **single container** to simplify Vast.ai deployment.

1.  **Multi-Stage Build**:
    -   Stage 1: Build React Frontend (`npm run build`).
    -   Stage 2: Build Python Backend (Install Torch/WhisperX).
    -   Stage 3: Final CUDA Runtime (Copy Frontend dist to FastAPI `/static`, mount backend).
2.  **Environment Variables**:
    -   `UMS_STORAGE`: Path for persistent data (auto-created if missing).
    -   `HF_TOKEN`: For diarization.
3.  **Entrypoint**: `start.py` that validates hardware, ensures storage exists, and launches Uvicorn.

---

## 5. Development Guidelines

- **"Less is More"**: Avoid heavy dependencies purely for UI widgets. Use native browser APIs or lightweight React libraries.
- **Type Safety**: Full Pydantic models for backend, Zod schemas for frontend.
- **Error Handling**: No silent failures. If FFmpeg fails, the UI must show the exact stderr output in a friendly modal.

Generate the complete boilerplate structure, `Dockerfile`, `requirements.txt`, and key source files (`main.py`, `App.tsx`) to kickstart this migration.
