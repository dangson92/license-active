-- Migration: Multi-platform version support
-- Created: 2026-03-17
-- Description:
--   - Add UNIQUE constraint on (app_id, version, platform) to allow same version
--     number across different platforms (e.g., 2.1.0 Windows + 2.1.0 macOS)
--   - Backfill NULL platform values to 'Windows' for safety

-- Backfill: đảm bảo không có platform = NULL (để UNIQUE constraint hoạt động đúng)
UPDATE app_versions SET platform = 'Windows' WHERE platform IS NULL OR platform = '';

-- Thêm UNIQUE constraint mới: (app_id, version, platform)
-- Nếu đã có duplicate data thì cần clean trước khi chạy migration này
ALTER TABLE app_versions
  ADD CONSTRAINT uq_app_version_platform UNIQUE (app_id, version, platform);
