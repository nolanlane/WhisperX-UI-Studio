# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy package files (we will create these later, but assuming they exist for Docker build flow)
COPY frontend/package*.json ./
# Install deps (using --legacy-peer-deps if needed for React 19 betas)
RUN npm install --legacy-peer-deps
COPY frontend/ ./
# Build (output to /app/frontend/dist)
RUN npm run build

# ==========================================
# Stage 2: Runtime Environment
# ==========================================
FROM nvidia/cuda:12.8.0-cudnn-runtime-ubuntu22.04

# Remove interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install System Dependencies
# python3.10 is default in ubuntu22.04
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python Package Management
COPY requirements.txt .
# Install PyTorch specifically for CUDA 12.4 first to ensure it matches base image logic if needed
# But standard pip install usually handles it. Using specific index for torch if critical.
# Upgrade pip to fix resolver assertion errors in older versions
RUN pip3 install --no-cache-dir --upgrade pip
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY backend ./backend
COPY start.py .
COPY onstart.sh .
RUN chmod +x onstart.sh

# Copy Built Frontend Static Files
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Environment Variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose Port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start
CMD ["python3", "start.py"]
