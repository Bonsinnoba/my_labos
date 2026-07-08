@echo off
REM Startup script for Instapods Hub (Windows)

echo ==========================================
echo Starting Instapods Hub
echo ==========================================

REM Check if .env exists
if not exist .env (
    echo Error: .env file not found!
    echo Please copy .env.example to .env and configure your environment variables.
    exit /b 1
)

REM Check if virtual environment exists
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Start the server
echo Starting Instapods Hub server...
python instapods_hub.py
