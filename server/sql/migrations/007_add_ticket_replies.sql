-- Migration: Add ticket_replies table and update notification types
-- Created: 2026-01-20

-- Ticket replies table (supports both admin and user replies)
CREATE TABLE IF NOT EXISTS ticket_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  admin_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reply_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_admin FOREIGN KEY (admin_id) REFERENCES users(id),
  CONSTRAINT fk_reply_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add index for faster lookups
CREATE INDEX idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

-- Note: Either admin_id OR user_id should be set (not both)
