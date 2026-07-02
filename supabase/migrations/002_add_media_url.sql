-- Migration: Add media_url to notebook_entries, rd_logs, and findings tables

ALTER TABLE notebook_entries ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE rd_logs ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS media_url TEXT;
