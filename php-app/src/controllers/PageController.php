<?php
/**
 * Page Controller
 * Renders HTML views
 */

namespace App\Controllers;

use App\Config\Config;

class PageController extends BaseController
{
    /**
     * GET /
     * Home page - redirect to login
     */
    public function home(): void
    {
        $this->redirect('/diabetic-retinopathy/php-app/public/login');
    }

    /**
     * GET /login
     * Login page (center admin)
     */
    public function login(): void
    {
        $this->view('auth/login', [
            'title' => 'Connexion - Administration',
            'role' => 'center_admin'
        ]);
    }

    /**
     * GET /doctor/login
     * Doctor login page
     */
    public function doctorLogin(): void
    {
        $this->view('auth/login', [
            'title' => 'Connexion - Médecin',
            'role' => 'doctor'
        ]);
    }

    /**
     * GET /center/dashboard
     * Center admin dashboard
     */
    public function centerDashboard(): void
    {
        $this->view('center/dashboard', [
            'title' => 'Tableau de bord - Administration'
        ]);
    }

    /**
     * GET /center/patients
     * Patient management page
     */
    public function centerPatients(): void
    {
        $this->view('center/patients', [
            'title' => 'Gestion des Patients'
        ]);
    }

    /**
     * GET /center/doctors
     * Doctor management page
     */
    public function centerDoctors(): void
    {
        $this->view('center/doctors', [
            'title' => 'Gestion des Médecins'
        ]);
    }

    /**
     * GET /center/new-exam
     * New exam upload page
     */
    public function centerNewExam(): void
    {
        $this->view('center/new-exam', [
            'title' => 'Nouvel Examen'
        ]);
    }

    /**
     * GET /doctor/dashboard
     * Doctor dashboard
     */
    public function doctorDashboard(): void
    {
        $this->view('doctor/dashboard', [
            'title' => 'Tableau de bord',
            'wsUrl' => Config::websocket()['url']
        ]);
    }

    /**
     * GET /doctor/exams/{id}
     * Exam detail page
     */
    public function doctorExamDetail(array $params): void
    {
        $this->view('doctor/exam-detail', [
            'title' => 'Détail de l\'examen',
            'examId' => $params['id']
        ]);
    }

    /**
     * GET /doctor/alerts
     * Alerts management page
     */
    public function doctorAlerts(): void
    {
        $this->view('doctor/alerts', [
            'title' => 'Gestion des Alertes'
        ]);
    }
}
