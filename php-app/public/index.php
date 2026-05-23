<?php
/**
 * Main Entry Point & Router
 * Handles all HTTP requests
 */

// Error reporting for development
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Define base paths
define('ROOT_PATH', dirname(__DIR__));
define('PUBLIC_PATH', __DIR__);
define('SRC_PATH', ROOT_PATH . '/src');

// Autoloader
spl_autoload_register(function ($class) {
    // Convert namespace to path
    $prefix = 'App\\';
    $baseDir = SRC_PATH . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// Load environment
use App\Config\Env;
use App\Config\Config;

try {
    Env::load(ROOT_PATH);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

// Start session
session_start();

// Get request info
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Remove base path from URI (for XAMPP subdirectory)
$basePath = '/diabetic-retinopathy/php-app/public';
$uri = parse_url($requestUri, PHP_URL_PATH);
if (strpos($uri, $basePath) === 0) {
    $uri = substr($uri, strlen($basePath));
}
$uri = $uri ?: '/';

// CORS headers for API
if (strpos($uri, '/api/') === 0) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    if ($requestMethod === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Simple Router
$routes = [
    // =====================
    // API Routes
    // =====================
    
    // Auth
    'POST /api/auth/login' => ['AuthController', 'login'],
    'GET /api/auth/verify' => ['AuthController', 'verify'],
    'POST /api/auth/logout' => ['AuthController', 'logout'],
    
    // Center Admin - Patients
    'GET /api/center/patients' => ['PatientController', 'index'],
    'POST /api/center/patients' => ['PatientController', 'store'],
    'GET /api/center/patients/{id}' => ['PatientController', 'show'],
    'PUT /api/center/patients/{id}' => ['PatientController', 'update'],
    'DELETE /api/center/patients/{id}' => ['PatientController', 'destroy'],
    
    // Center Admin - Doctors
    'GET /api/center/doctors' => ['DoctorController', 'index'],
    'POST /api/center/doctors' => ['DoctorController', 'store'],
    'GET /api/center/doctors/{id}' => ['DoctorController', 'show'],
    'PUT /api/center/doctors/{id}' => ['DoctorController', 'update'],
    
    // Exams
    'POST /api/exams' => ['ExamController', 'store'],
    'GET /api/exams/{id}' => ['ExamController', 'show'],
    
    // Doctor - Exams
    'GET /api/doctor/exams' => ['DoctorExamController', 'index'],
    'GET /api/doctor/exams/{id}' => ['DoctorExamController', 'show'],
    'GET /api/doctor/stats' => ['DoctorExamController', 'stats'],
    
    // Doctor - Alerts
    'GET /api/doctor/alerts' => ['AlertController', 'index'],
    'PUT /api/doctor/alerts/{id}/read' => ['AlertController', 'markRead'],
    'PUT /api/doctor/alerts/{id}/resolve' => ['AlertController', 'resolve'],
    
    // =====================
    // Web Routes (Views)
    // =====================
    
    // Public
    'GET /' => ['PageController', 'home'],
    'GET /login' => ['PageController', 'login'],
    
    // Center Admin Pages
    'GET /center/dashboard' => ['PageController', 'centerDashboard'],
    'GET /center/patients' => ['PageController', 'centerPatients'],
    'GET /center/doctors' => ['PageController', 'centerDoctors'],
    'GET /center/new-exam' => ['PageController', 'centerNewExam'],
    
    // Doctor Pages
    'GET /doctor/login' => ['PageController', 'doctorLogin'],
    'GET /doctor/dashboard' => ['PageController', 'doctorDashboard'],
    'GET /doctor/exams/{id}' => ['PageController', 'doctorExamDetail'],
    'GET /doctor/alerts' => ['PageController', 'doctorAlerts'],
];

// Route matching
$matchedRoute = null;
$params = [];

foreach ($routes as $route => $handler) {
    list($method, $pattern) = explode(' ', $route, 2);
    
    if ($method !== $requestMethod) {
        continue;
    }
    
    // Convert {param} to regex
    $regex = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    
    if (preg_match($regex, $uri, $matches)) {
        $matchedRoute = $handler;
        // Extract named parameters
        foreach ($matches as $key => $value) {
            if (is_string($key)) {
                $params[$key] = $value;
            }
        }
        break;
    }
}

if ($matchedRoute) {
    $controllerName = 'App\\Controllers\\' . $matchedRoute[0];
    $methodName = $matchedRoute[1];
    
    if (class_exists($controllerName)) {
        $controller = new $controllerName();
        if (method_exists($controller, $methodName)) {
            try {
                $controller->$methodName($params);
            } catch (Exception $e) {
                if (strpos($uri, '/api/') === 0) {
                    http_response_code(500);
                    echo json_encode([
                        'error' => 'Internal Server Error',
                        'message' => Config::app()['debug'] ? $e->getMessage() : 'An error occurred'
                    ]);
                } else {
                    http_response_code(500);
                    echo '<h1>Erreur Serveur</h1>';
                    if (Config::app()['debug']) {
                        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
                    }
                }
            }
            exit;
        }
    }
}

// 404 Not Found
http_response_code(404);
if (strpos($uri, '/api/') === 0) {
    echo json_encode(['error' => 'Endpoint not found']);
} else {
    include SRC_PATH . '/views/errors/404.php';
}
