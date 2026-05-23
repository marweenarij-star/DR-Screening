-- ============================================
-- Diabetic Retinopathy Screening System
-- Database Schema for MySQL 8.0+
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables if exist (for fresh install)
DROP TABLE IF EXISTS `alerts`;
DROP TABLE IF EXISTS `exams`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `centers`;

-- ============================================
-- Table: centers
-- ============================================
CREATE TABLE `centers` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `address` TEXT,
    `phone` VARCHAR(20),
    `email` VARCHAR(255),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: users (center_admin and doctors)
-- ============================================
CREATE TABLE `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `center_id` INT UNSIGNED NOT NULL,
    `role` ENUM('center_admin', 'doctor') NOT NULL,
    `identity` VARCHAR(50) DEFAULT NULL COMMENT 'Identity/ID number (e.g., passport, national ID)',
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) DEFAULT NULL COMMENT 'Null until user sets password',
    `speciality` VARCHAR(100) DEFAULT NULL COMMENT 'For doctors only',
    `address` TEXT DEFAULT NULL COMMENT 'Address (for doctors)',
    `phone` VARCHAR(20) DEFAULT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `account_status` ENUM('pending', 'active', 'inactive') DEFAULT 'pending' COMMENT 'pending: awaiting activation, active: account activated, inactive: deactivated',
    `activation_token` VARCHAR(255) DEFAULT NULL COMMENT 'Signed JWT token for account activation',
    `token_expires_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Activation token expiration (24 hours from creation)',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_login` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_email` (`email`),
    UNIQUE KEY `idx_activation_token` (`activation_token`),
    KEY `idx_center_role` (`center_id`, `role`),
    KEY `idx_account_status` (`account_status`),
    CONSTRAINT `fk_users_center` FOREIGN KEY (`center_id`) REFERENCES `centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: patients
-- ============================================
CREATE TABLE `patients` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `center_id` INT UNSIGNED NOT NULL,
    `medical_record_number` VARCHAR(50) DEFAULT NULL COMMENT 'Numéro de dossier médical',
    `full_name` VARCHAR(255) NOT NULL,
    `date_of_birth` DATE DEFAULT NULL,
    `age` INT UNSIGNED DEFAULT NULL COMMENT 'Calculated or manual',
    `gender` ENUM('M', 'F', 'other') DEFAULT NULL,
    `diabetic_years` INT UNSIGNED DEFAULT NULL COMMENT 'Years with diabetes',
    `diabetes_type` ENUM('type1', 'type2', 'gestational', 'other') DEFAULT NULL,
    `phone` VARCHAR(20) DEFAULT NULL,
    `email` VARCHAR(255) DEFAULT NULL,
    `address` TEXT DEFAULT NULL,
    `notes` TEXT DEFAULT NULL COMMENT 'Medical notes',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_center` (`center_id`),
    KEY `idx_medical_record` (`medical_record_number`),
    KEY `idx_name` (`full_name`),
    CONSTRAINT `fk_patients_center` FOREIGN KEY (`center_id`) REFERENCES `centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: exams
-- ============================================
CREATE TABLE `exams` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `center_id` INT UNSIGNED NOT NULL,
    `patient_id` INT UNSIGNED NOT NULL,
    `doctor_id` INT UNSIGNED NOT NULL,
    `image_path` VARCHAR(500) NOT NULL COMMENT 'Path to original fundus image',
    `heatmap_path` VARCHAR(500) DEFAULT NULL COMMENT 'Path to Grad-CAM heatmap',
    `overlay_path` VARCHAR(500) DEFAULT NULL COMMENT 'Path to overlay image',
    `grade` TINYINT UNSIGNED NOT NULL COMMENT '0-4 DR severity grade',
    `confidence` DECIMAL(5,2) NOT NULL COMMENT 'AI confidence 0-100%',
    `eye` ENUM('left', 'right', 'unknown') DEFAULT 'unknown',
    `notes` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_doctor_grade_date` (`doctor_id`, `grade` DESC, `created_at` DESC),
    KEY `idx_patient` (`patient_id`),
    KEY `idx_center` (`center_id`),
    KEY `idx_grade` (`grade`),
    KEY `idx_created` (`created_at` DESC),
    CONSTRAINT `fk_exams_center` FOREIGN KEY (`center_id`) REFERENCES `centers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_exams_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_exams_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: alerts
-- ============================================
CREATE TABLE `alerts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `exam_id` INT UNSIGNED NOT NULL,
    `doctor_id` INT UNSIGNED NOT NULL,
    `type` ENUM('urgent') NOT NULL DEFAULT 'urgent',
    `message` TEXT NOT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `is_resolved` TINYINT(1) DEFAULT 0,
    `resolved_comment` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `read_at` TIMESTAMP NULL DEFAULT NULL,
    `resolved_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_doctor_read_resolved` (`doctor_id`, `is_read`, `is_resolved`, `created_at` DESC),
    KEY `idx_exam` (`exam_id`),
    CONSTRAINT `fk_alerts_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_alerts_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Table: refresh_tokens (for token management)
-- ============================================
CREATE TABLE `refresh_tokens` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user` (`user_id`),
    KEY `idx_token` (`token`(255)),
    CONSTRAINT `fk_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Grades Reference (for documentation):
-- 0 = No DR (Pas de RD)
-- 1 = Mild NPDR (RD non proliférante légère)
-- 2 = Moderate NPDR (RD non proliférante modérée)
-- 3 = Severe NPDR (RD non proliférante sévère)
-- 4 = PDR (RD proliférante)
-- ============================================
