-- Migration: Add project_stage_id column to rd_logs table
-- Run this in the Supabase SQL Editor if project_stage_id is missing from the live DB.

ALTER TABLE rd_logs
    ADD COLUMN IF NOT EXISTS project_stage_id UUID;

-- Add foreign key constraint for project_stage_id
ALTER TABLE rd_logs
    ADD CONSTRAINT fk_rd_logs_project_stage_id 
    FOREIGN KEY (project_stage_id) REFERENCES project_stages(id) ON DELETE SET NULL;

-- Create index for project_stage_id
CREATE INDEX IF NOT EXISTS idx_rd_logs_project_stage_id ON rd_logs(project_stage_id);
