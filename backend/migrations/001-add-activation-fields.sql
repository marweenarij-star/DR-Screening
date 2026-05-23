-- Migration: Add activation fields to users table
-- Purpose: Support doctor account activation workflow with email verification
-- Author: System
-- Date: 2026-05-04

-- Add new columns to users table
ALTER TABLE users ADD COLUMN identity VARCHAR(50) DEFAULT NULL COMMENT 'Identity/ID number (e.g., passport, national ID)';
ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'pending' COMMENT 'pending: awaiting activation, active: account activated, inactive: deactivated';
ALTER TABLE users ADD COLUMN activation_token TEXT DEFAULT NULL COMMENT 'Signed JWT token for account activation';
ALTER TABLE users ADD COLUMN token_expires_at DATETIME DEFAULT NULL COMMENT 'Activation token expiration (24 hours from creation)';

-- Make password_hash nullable for new users waiting to activate
-- Note: SQLite does not support modifying column constraints, so we just document that it should be NULL for pending accounts
-- and handle this in the application logic

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_activation_token ON users(activation_token);
CREATE INDEX IF NOT EXISTS idx_account_status ON users(account_status);

-- Migration complete
