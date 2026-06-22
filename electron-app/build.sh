#!/bin/bash
# Build script for Electron app with Python backend

set -e

echo "=========================================="
echo "Building Lab R&D Desktop App"
echo "=========================================="

# Step 1: Build Python backend
echo ""
echo "Step 1: Building Python backend with PyInstaller..."
npm run build-python

# Step 2: Build Electron app
echo ""
echo "Step 2: Building Electron app..."
npm run build

echo ""
echo "=========================================="
echo "Build complete!"
echo "=========================================="
echo ""
echo "Output: dist/"
echo ""
echo "Installers:"
echo "  - Windows: dist/Lab R&D Setup.exe"
echo "  - macOS: dist/Lab R&D.dmg"
echo "  - Linux: dist/Lab R&D.AppImage"
