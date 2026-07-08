#!/bin/bash
# Startup script for Instapods Hub

echo "=========================================="
echo "Starting Instapods Hub"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please copy .env.example to .env and configure your environment variables."
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if virtual environment exists
if [ ! -d venv ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the server
echo "Starting Instapods Hub server..."
python instapods_hub.py
