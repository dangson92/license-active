-- Migration: Add ticket_replies table and update notification types
-- Created: 2026-01-20

-- Option 1: If table doesn't exist yet, create it with all columns
CREATE TABLE IF NOT EXISTS ticket_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  admin_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reply_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_admin FOREIGN KEY (admin_id) REFERENCES users(id),
  CONSTRAINT fk_reply_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_ticket_replies_ticket_id (ticket_id)
);

-- Option 2: If table exists but missing user_id column, run these manually:
-- ALTER TABLE ticket_replies ADD COLUMN user_id INT DEFAULT NULL AFTER admin_id;
-- ALTER TABLE ticket_replies MODIFY COLUMN admin_id INT DEFAULT NULL;

-- Note: Either admin_id OR user_id should be set (not both)
