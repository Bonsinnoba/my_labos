# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY lab_app/ ./lab_app/

# Create necessary directories
RUN mkdir -p lab_app/knowledge_vault lab_app/database

# Expose port 8000
EXPOSE 8000

# Run the application with uvicorn
CMD ["uvicorn", "lab_app.api_server:app", "--host", "0.0.0.0", "--port", "8000"]
