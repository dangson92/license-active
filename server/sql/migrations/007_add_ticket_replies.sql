-- Migration: Add ticket_replies table and update notification types
-- Created: 2026-01-20

-- Ticket replies table
CREATE TABLE IF NOT EXISTS ticket_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  admin_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reply_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_admin FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- Add index for faster lookups
CREATE INDEX idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

-- Add new notification types (if needed)
-- Note: MySQL ENUM can be modified with ALTER TABLE
-- ALTER TABLE notifications MODIFY COLUMN type ENUM('new_order', 'order_paid', 'order_approved', 'order_rejected', 'new_ticket', 'ticket_status', 'ticket_reply', 'license_expiring', 'system') NOT NULL DEFAULT 'system';
