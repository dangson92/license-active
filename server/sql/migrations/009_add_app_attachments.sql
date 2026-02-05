-- Migration: Add app attachments and version-attachment links
-- Created: 2024-02-05
-- Description: 
--   1. app_attachments: Store attachment files (plugins) per app
--   2. version_attachment_links: Many-to-many relationship between versions and attachments

-- Attachments table (thuộc app, không thuộc version cụ thể)
CREATE TABLE IF NOT EXISTS app_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL COMMENT 'Generated filename after upload',
  original_name VARCHAR(255) NOT NULL COMMENT 'Original filename from user',
  file_size BIGINT NULL COMMENT 'Size in bytes',
  description VARCHAR(500) NULL COMMENT 'Display name, e.g. Plugin ABC',
  download_url VARCHAR(512) NOT NULL,
  storage_type ENUM('vps', 'idrive-e2') NOT NULL DEFAULT 'vps',
  storage_key VARCHAR(255) NULL COMMENT 'S3 key for iDrive E2',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attachments_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  INDEX idx_app_attachments_app_id (app_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction table: link version với attachments (many-to-many)
CREATE TABLE IF NOT EXISTS version_attachment_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  attachment_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_link_version FOREIGN KEY (version_id) REFERENCES app_versions(id) ON DELETE CASCADE,
  CONSTRAINT fk_link_attachment FOREIGN KEY (attachment_id) REFERENCES app_attachments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_version_attachment (version_id, attachment_id),
  INDEX idx_link_version_id (version_id),
  INDEX idx_link_attachment_id (attachment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
