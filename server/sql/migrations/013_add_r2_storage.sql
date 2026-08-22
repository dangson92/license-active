-- Migration: 013_add_r2_storage.sql
-- Thêm Cloudflare R2 làm nơi lưu trữ file (song song với iDrive E2 và VPS).
-- Lý do: gói iDrive E2 sắp hết hạn, cần chuyển dần sang R2.
--
-- An toàn khi chạy lại: chỉ mở rộng ENUM, không đụng dữ liệu cũ.
-- Các bản ghi 'vps' / 'idrive-e2' hiện có giữ nguyên giá trị.

ALTER TABLE app_attachments
  MODIFY COLUMN storage_type ENUM('vps', 'idrive-e2', 'r2') NOT NULL DEFAULT 'vps';

ALTER TABLE app_attachments
  MODIFY COLUMN storage_key VARCHAR(255) NULL COMMENT 'Object key trên cloud (S3-compatible: iDrive E2 / Cloudflare R2)';
