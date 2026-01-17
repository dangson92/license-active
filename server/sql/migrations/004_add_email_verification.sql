-- Migration: Add email verification and settings
-- Run this migration: mysql -u license_user -p license_db < 004_add_email_verification.sql

-- Add email verification fields to users table
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN verification_token VARCHAR(255) NULL,
ADD COLUMN verification_expires DATETIME NULL;

-- Create settings table for SMTP and other configs
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value) VALUES
('smtp_host', ''),
('smtp_port', '587'),
('smtp_user', ''),
('smtp_pass', ''),
('smtp_from', ''),
('smtp_secure', 'false'),
('app_name', 'License System'),
('email_verify_required', 'true')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
