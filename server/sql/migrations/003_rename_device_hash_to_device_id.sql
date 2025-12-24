-- Migration: Rename device_hash to device_id in activations table
-- Date: 2025-01-07
-- Description: Remove server-side hashing, use client device ID directly for easier management

-- Drop the old unique constraint
ALTER TABLE activations
DROP INDEX uniq_activation;

-- Rename the column
ALTER TABLE activations
CHANGE COLUMN device_hash device_id VARCHAR(255) NOT NULL;

-- Recreate the unique constraint with new column name
ALTER TABLE activations
ADD UNIQUE KEY uniq_activation (license_id, device_id);
