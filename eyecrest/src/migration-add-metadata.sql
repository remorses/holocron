-- Migration to add metadata column to existing files table
-- This migration handles cases where the table already exists without the metadata column

-- Add the new column (will fail if it already exists, which is okay)
ALTER TABLE files ADD COLUMN metadata TEXT;

-- Note: The metadata column will be NULL for existing files
-- New uploads will include metadata if provided in the API request