#!/bin/bash
# Sync ALL files from my_lab to instapods-hub before deployment
# my_lab is the source of truth, instapods-hub is deployment copy

set -e

echo "=========================================="
echo "Syncing files from my_lab to instapods-hub"
echo "=========================================="

# Source directory (my_lab)
SOURCE_DIR="../my_lab"
TARGET_DIR="."

# Copy main application file
echo "Copying instapods_hub.py..."
cp "$SOURCE_DIR/instapods_hub.py" "$TARGET_DIR/"

# Copy shared database files
echo "Copying mesh_sync_coordinator.py..."
cp "$SOURCE_DIR/lab_app/database/mesh_sync_coordinator.py" "$TARGET_DIR/lab_app/database/"

echo "Copying cache_db.py..."
cp "$SOURCE_DIR/lab_app/database/cache_db.py" "$TARGET_DIR/lab_app/database/"

echo "Copying cloud_sync_engine.py..."
cp "$SOURCE_DIR/lab_app/database/cloud_sync_engine.py" "$TARGET_DIR/lab_app/database/"

echo "Copying mobile_cloud_api.py..."
cp "$SOURCE_DIR/lab_app/database/mobile_cloud_api.py" "$TARGET_DIR/lab_app/database/"

echo "Copying auth_manager.py..."
cp "$SOURCE_DIR/lab_app/auth/auth_manager.py" "$TARGET_DIR/lab_app/auth/"

# Copy requirements
echo "Copying requirements.txt..."
cp "$SOURCE_DIR/requirements.txt" "$TARGET_DIR/"

# Copy Supabase migration
echo "Copying Supabase migration..."
cp "$SOURCE_DIR/supabase/migrations/001_initial_schema.sql" "$TARGET_DIR/supabase/migrations/"

# Copy documentation
echo "Copying INSTAPODS_HUB.md..."
cp "$SOURCE_DIR/INSTAPODS_HUB.md" "$TARGET_DIR/README.md"

# Copy .env.example
echo "Copying .env.example..."
cp "$SOURCE_DIR/.env.example" "$TARGET_DIR/"

echo ""
echo "=========================================="
echo "Sync complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit changes: git add . && git commit -m 'Sync from my_lab'"
echo "3. Push to GitHub: git push"
echo "4. Deploy from Instapods dashboard"
