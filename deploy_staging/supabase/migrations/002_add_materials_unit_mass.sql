-- Migration: Add unit_mass and unit_mass_unit columns to materials table
-- Run this in the Supabase SQL Editor if these columns are missing from the live DB.

ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS unit_mass REAL DEFAULT 0;

ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS unit_mass_unit TEXT DEFAULT 'g';
