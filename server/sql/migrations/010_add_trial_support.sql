-- =============================================
-- Migration 010: Trial License Support
-- Adds 7-day trial functionality with device-level anti-abuse
-- =============================================

-- 1. Add is_trial flag to licenses table
ALTER TABLE licenses ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add trial_enabled to app_pricing
ALTER TABLE app_pricing ADD COLUMN trial_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Device tracking table for trial anti-abuse
-- Tracks which device has used trial for which app (persists forever)
CREATE TABLE IF NOT EXISTS trial_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_id INT NOT NULL,
  user_id INT NOT NULL,
  license_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_trial_device_app (device_id, app_id),
  CONSTRAINT fk_trial_devices_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_devices_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
);
