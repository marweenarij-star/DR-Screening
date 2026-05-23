-- ============================================
-- Diabetic Retinopathy Screening System
-- Seed Data for Development/Testing
-- ============================================

SET NAMES utf8mb4;

-- ============================================
-- Insert Center
-- ============================================
INSERT INTO `centers` (`id`, `name`, `address`, `phone`, `email`) VALUES
(1, 'Centre Ophtalmologique Saint-Michel', '123 Avenue de la Santé, 75014 Paris, France', '+33 1 42 00 00 00', 'contact@ophtalmo-stmichel.fr');

-- ============================================
-- Insert Users
-- Password for all users: "password123" (hashed with password_hash PHP function)
-- Hash: $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- ============================================
INSERT INTO `users` (`id`, `center_id`, `role`, `name`, `email`, `password_hash`, `speciality`, `phone`, `is_active`) VALUES
(1, 1, 'center_admin', 'Marie Dupont', 'admin@ophtalmo-stmichel.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', NULL, '+33 6 12 34 56 78', 1),
(2, 1, 'doctor', 'Dr. Jean Martin', 'dr.martin@ophtalmo-stmichel.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ophtalmologie - Rétine', '+33 6 23 45 67 89', 1),
(3, 1, 'doctor', 'Dr. Sophie Leroy', 'dr.leroy@ophtalmo-stmichel.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ophtalmologie - Diabétologie', '+33 6 34 56 78 90', 1),
(4, 1, 'doctor', 'Dr. Pierre Moreau', 'dr.moreau@ophtalmo-stmichel.fr', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ophtalmologie Générale', '+33 6 45 67 89 01', 1);

-- ============================================
-- Insert Patients
-- ============================================
INSERT INTO `patients` (`id`, `center_id`, `medical_record_number`, `full_name`, `date_of_birth`, `age`, `gender`, `diabetic_years`, `diabetes_type`, `phone`, `email`, `address`, `notes`) VALUES
(1, 1, 'DM-2024-001', 'Ahmed Benali', '1965-03-15', 60, 'M', 15, 'type2', '+33 6 11 22 33 44', 'a.benali@email.fr', '45 Rue de la République, 75011 Paris', 'Diabète type 2 depuis 15 ans. Suivi régulier recommandé.'),
(2, 1, 'DM-2024-002', 'Françoise Petit', '1958-07-22', 67, 'F', 20, 'type2', '+33 6 22 33 44 55', 'f.petit@email.fr', '12 Boulevard Voltaire, 75011 Paris', 'Antécédents familiaux de rétinopathie.'),
(3, 1, 'DM-2024-003', 'Mohammed Kaddouri', '1972-11-08', 53, 'M', 8, 'type2', '+33 6 33 44 55 66', 'm.kaddouri@email.fr', '78 Avenue Gambetta, 75020 Paris', 'HbA1c bien contrôlée.'),
(4, 1, 'DM-2024-004', 'Claire Dubois', '1980-05-30', 45, 'F', 25, 'type1', '+33 6 44 55 66 77', 'c.dubois@email.fr', '23 Rue Oberkampf, 75011 Paris', 'Diabète type 1 depuis l\'enfance. Pompe à insuline.'),
(5, 1, 'DM-2024-005', 'Jean-Luc Bernard', '1955-09-12', 70, 'M', 18, 'type2', '+33 6 55 66 77 88', 'jl.bernard@email.fr', '56 Rue de Charonne, 75011 Paris', 'Hypertension associée. Traitement combiné.'),
(6, 1, 'DM-2024-006', 'Fatima Alaoui', '1968-02-28', 57, 'F', 12, 'type2', '+33 6 66 77 88 99', 'f.alaoui@email.fr', '89 Boulevard de Belleville, 75019 Paris', NULL),
(7, 1, 'DM-2024-007', 'Philippe Rousseau', '1975-12-03', 50, 'M', 5, 'type2', '+33 6 77 88 99 00', 'p.rousseau@email.fr', '34 Rue de Ménilmontant, 75020 Paris', 'Diagnostic récent. Premier dépistage rétinien.'),
(8, 1, 'DM-2024-008', 'Isabelle Fournier', '1962-08-17', 63, 'F', 22, 'type2', '+33 6 88 99 00 11', 'i.fournier@email.fr', '67 Avenue Philippe Auguste, 75011 Paris', 'Cataracte opérée œil droit en 2023.'),
(9, 1, 'DM-2024-009', 'Youssef El Mansouri', '1978-04-25', 47, 'M', 10, 'type2', '+33 6 99 00 11 22', 'y.elmansouri@email.fr', '90 Rue de la Roquette, 75011 Paris', NULL),
(10, 1, 'DM-2024-010', 'Monique Girard', '1950-06-10', 75, 'F', 30, 'type2', '+33 6 00 11 22 33', 'm.girard@email.fr', '15 Place de la Nation, 75012 Paris', 'Rétinopathie légère diagnostiquée en 2022. Surveillance rapprochée.');

-- ============================================
-- Note: Exams and Alerts will be created 
-- dynamically through the application.
-- The seeds provide a clean starting point.
-- ============================================
