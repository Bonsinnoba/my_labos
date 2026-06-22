"""
Python build script for Electron app
Uses PyInstaller to bundle Python backend
"""

import PyInstaller.__main__
import os
import shutil

def build_python():
    """Build Python backend with PyInstaller"""
    
    # PyInstaller configuration
    pyinstaller_args = [
        '../start_web_app.py',
        '--onefile',
        '--name=lab-backend',
        '--distpath=python-dist',
        '--add-data=../lab_app:lab_app',
        '--add-data=../supabase:supabase',
        '--hidden-import=boto3',
        '--hidden-import=supabase',
        '--hidden-import=fastapi',
        '--hidden-import=uvicorn',
        '--noconsole',
        '--clean',
    ]
    
    print("Building Python backend with PyInstaller...")
    print("This may take several minutes...")
    
    PyInstaller.__main__.run(pyinstaller_args)
    
    print("Python build complete!")
    print("Output: python-dist/lab-backend")

if __name__ == '__main__':
    build_python()
