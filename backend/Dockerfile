FROM python:3.11-slim

# Install system dependencies including gfortran (required by scipy/scikit-learn)
# and Node.js for the backend server
RUN apt-get update && apt-get install -y \
    curl \
    gfortran \
    gcc \
    g++ \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies:
# --prefer-binary  → use pre-built wheels when available (avoids Fortran/C compilation)
# --no-cache-dir   → keep image size small
# Falls back to source build ONLY if no wheel exists, with gfortran now available
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Copy the backend directory
COPY backend/ ./backend/

# Copy the ai-service directory (needed for AI inference)
COPY ai-service/ ./ai-service/

# Install Node.js dependencies
RUN cd backend && npm install --production

# Set environment variables
ENV PYTHONPATH=/app/ai-service:/app/backend
ENV AI_SERVICE_DIR=/app/ai-service
ENV NODE_ENV=production

# Expose ports (Node.js: 3000, Python AI: 8000)
EXPOSE 3000 8000

# Start the Node.js server
WORKDIR /app/backend
CMD ["npm", "start"]
