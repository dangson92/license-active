-- Migration: 014_add_trial_days.sql
-- Cho phép cấu hình số ngày dùng thử theo từng ứng dụng (7 hoặc 14 ngày).
-- Trước đây thời hạn trial bị hard-code 7 ngày trong POST /api/store/trial.
--
-- Các bản ghi app_pricing hiện có nhận mặc định 7 → hành vi không đổi.

ALTER TABLE app_pricing
  ADD COLUMN trial_days INT NOT NULL DEFAULT 7 COMMENT 'Số ngày của license dùng thử (mặc định 7)';
