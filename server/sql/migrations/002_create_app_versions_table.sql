-- Tạo bảng lưu trữ các version của apps
CREATE TABLE IF NOT EXISTS app_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL,
  version VARCHAR(32) NOT NULL,
  release_date DATE NOT NULL,
  release_notes TEXT NULL,
  download_url VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NULL,
  file_size BIGINT NULL COMMENT 'Size in bytes',
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  platform VARCHAR(32) NOT NULL DEFAULT 'windows',
  file_type VARCHAR(32) NOT NULL DEFAULT 'zip',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_versions_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  INDEX idx_app_id (app_id),
  INDEX idx_version (version),
  INDEX idx_created_at (created_at)
);
