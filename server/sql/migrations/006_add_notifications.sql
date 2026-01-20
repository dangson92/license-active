-- Notifications table for admin alerts
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  type ENUM('new_order', 'order_paid', 'new_ticket', 'license_expiring', 'system') NOT NULL DEFAULT 'system',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at);
