#!/bin/bash
# Stop any running Jupyter
pkill -f jupyter || true

# Start WhisperX-Studio
cd /app
python3 start.py
