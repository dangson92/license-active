-- Add columns to apps table (for ApplicationSetting)
ALTER TABLE apps ADD COLUMN description TEXT NULL;
ALTER TABLE apps ADD COLUMN icon_url VARCHAR(500) NULL;
ALTER TABLE apps ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Support Tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  category ENUM('technical','billing','account','feature','other') NOT NULL DEFAULT 'other',
  message TEXT NOT NULL,
  status ENUM('pending','in_progress','resolved','closed') NOT NULL DEFAULT 'pending',
  priority ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  resolved_at DATETIME NULL,
  resolved_by_admin_id INT NULL,
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_admin FOREIGN KEY (resolved_by_admin_id) REFERENCES users(id)
);

-- FAQs table
CREATE TABLE IF NOT EXISTS faqs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(500) NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100) NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
);

-- App Pricing table (extends apps table with pricing info)
CREATE TABLE IF NOT EXISTS app_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_id INT NOT NULL UNIQUE,
  description TEXT NULL,
  price_1_month DECIMAL(10,2) NULL,
  price_6_months DECIMAL(10,2) NULL,
  price_1_year DECIMAL(10,2) NULL,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  badge VARCHAR(50) NULL,
  icon_class VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT fk_pricing_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  app_id INT NOT NULL,
  order_code VARCHAR(50) UNIQUE NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  duration_months INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','cancelled','refunded') NOT NULL DEFAULT 'pending',
  receipt_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  processed_by_admin_id INT NULL,
  notes TEXT NULL,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_admin FOREIGN KEY (processed_by_admin_id) REFERENCES users(id)
);

-- Insert sample FAQs
INSERT INTO faqs (question, answer, category, display_order) VALUES
('How do I renew my license key?', 'You can renew your license by going to the "Licenses" section in your dashboard. Click the "Renew" icon next to the license you wish to extend. Follow the payment instructions to complete the process.', 'licenses', 1),
('What does "Unbind Device" mean?', 'Each license is bound to a specific hardware ID to prevent unauthorized use. If you upgrade your computer or want to use the software on a different machine, you must first "Unbind" the current device to release the slot for a new one.', 'licenses', 2),
('Can I transfer my license to another user?', 'Currently, licenses are tied to the account that purchased them. However, for enterprise customers, license seats can be re-assigned by the organization administrator through the "Members" management tab.', 'account', 3),
('What happens if my license expires?', 'When a license expires, the application will enter a restricted mode. You will still be able to access your data, but advanced features and automated workflows will be disabled until a valid license is applied.', 'licenses', 4),
('Do you offer discounts for educational institutions?', 'Yes, we offer a 50% discount for verified educational institutions and non-profit organizations. Please submit a support ticket with your official documentation to apply for the discount.', 'billing', 5);
