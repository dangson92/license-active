-- Migration: 012_add_packages.sql
-- Add software package bundles (gói phần mềm) to the store

-- Table: packages — defines a bundle of apps sold together
CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(128) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  icon_url VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  badge VARCHAR(50) NULL,
  discount_percent DECIMAL(5,2) NULL,
  price_1_month DECIMAL(10,2) NULL,
  price_1_month_enabled TINYINT(1) NOT NULL DEFAULT 1,
  price_6_months DECIMAL(10,2) NULL,
  price_6_months_enabled TINYINT(1) NOT NULL DEFAULT 1,
  price_1_year DECIMAL(10,2) NULL,
  price_1_year_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
);

-- Table: package_items — many-to-many between packages and apps
CREATE TABLE IF NOT EXISTS package_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  app_id INT NOT NULL,
  UNIQUE KEY uniq_package_app (package_id, app_id),
  CONSTRAINT fk_package_items_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  CONSTRAINT fk_package_items_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- Extend purchase_orders to support both single-app and package orders
ALTER TABLE purchase_orders
  ADD COLUMN package_id INT NULL AFTER app_id,
  ADD CONSTRAINT fk_orders_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL;

-- Make app_id nullable (package orders don't have a single app_id)
ALTER TABLE purchase_orders MODIFY COLUMN app_id INT NULL;
