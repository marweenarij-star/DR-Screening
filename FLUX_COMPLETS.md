# 🔄 FLUX COMPLETS DE LA PLATEFORME DR SCREENING

## Table des matières

1. [Flux d'authentification](#flux-dauthentification)
2. [Flux d'upload d'examen](#flux-dupload-dexamen)
3. [Flux d'alerte en temps réel](#flux-dalerte-en-temps-réel)
4. [Flux de création médecin](#flux-de-création-médecin)
5. [Flux de prédiction IA](#flux-de-prédiction-ia)
6. [Flux de gestion patients](#flux-de-gestion-patients)
7. [Flux de tableau de bord](#flux-de-tableau-de-bord)
8. [Flux de résolution d'alerte](#flux-de-résolution-dalerte)

---

## 🔐 FLUX D'AUTHENTIFICATION

### Connexion utilisateur (Login)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: UTILISATEUR ACCÈDE AU PORTAIL                                  │
└─────────────────────────────────────────────────────────────────────────┘

Browser: https://platform.local/
    │
    ├─► GET /public/index.php
    │
    ▼ Response: HTML login page
┌──────────────────────────────────┐
│ Login Form                       │
├──────────────────────────────────┤
│ Email:        [____________]     │
│ Password:     [____________]     │
│ Remember Me:  [ ] Checkbox       │
│ [LOGIN]       [Forgot password]  │
└──────┬───────────────────────────┘
       │ User enters credentials
       │ Email: ahmed@clinic.com
       │ Password: ••••••••
       │
       │ Click [LOGIN]
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: SUBMIT FORM (POST REQUEST)                                     │
└─────────────────────────────────────────────────────────────────────────┘

Browser JavaScript:
┌────────────────────────────────────┐
│ Form submission handler            │
├────────────────────────────────────┤
│ Event: form.onsubmit               │
│ Prevent default                    │
│ Get form values                    │
│ Validate (email format, length)    │
│ Call: fetch('/api/auth/login')     │
└──────┬─────────────────────────────┘
       │
       ▼
POST /api/auth/login HTTP/1.1
Host: platform.local
Content-Type: application/json

{
  "email": "ahmed@clinic.com",
  "password": "secure_password_123"
}

       │
       │ Request travels over HTTPS/TLS
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: PHP BACKEND REÇOIT REQUEST                                     │
└─────────────────────────────────────────────────────────────────────────┘

/public/index.php (Main Router)
    │
    ├─► Parse URL: /api/auth/login
    │
    ├─► Route to: AuthController::login()
    │
    ▼
AuthController.php:
┌────────────────────────────────────────┐
│ public function login() {              │
├────────────────────────────────────────┤
│ 1. Get POST data:                      │
│    $email = $_POST['email']            │
│    $password = $_POST['password']      │
│                                        │
│ 2. Validate input:                     │
│    - Check email not empty            │
│    - Check password >= 8 chars        │
│    - Return 400 if invalid            │
│                                        │
│ 3. Call service:                       │
│    $user = AuthService::authenticate()│
│    ($email, $password)                 │
│                                        │
│ 4. Handle result:                      │
│    if ($user) → Generate JWT          │
│    else → Return 401 Unauthorized     │
└────────┬───────────────────────────────┘
         │
         ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: DATABASE LOOKUP                                                │
└─────────────────────────────────────────────────────────────────────────┘

DatabaseService::findUserByEmail($email)
    │
    ▼
MySQL Query:
SELECT id, name, email, password_hash, role, center_id,
       account_status, is_active
FROM users
WHERE email = 'ahmed@clinic.com'
LIMIT 1;

    │
    ▼ Returns 1 row:
┌───┬────────────────────┬─────────────────┬──────────┬──────┬─────────────┬────────────────┬───────────┐
│id │ name               │ email           │ password │ role │ center_id   │ account_status │ is_active │
├───┼────────────────────┼─────────────────┼──────────┼──────┼─────────────┼────────────────┼───────────┤
│ 2 │ Ahmed Hassan       │ahmed@clinic.com │$2y$10$… │ doc  │ 1           │ active         │ 1         │
└───┴────────────────────┴─────────────────┴──────────┴──────┴─────────────┴────────────────┴───────────┘
    │
    │ User found → verify password
    │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: PASSWORD VERIFICATION                                          │
└─────────────────────────────────────────────────────────────────────────┘

PHP: password_verify($password, $password_hash)
    │
    ├─► $password = "secure_password_123"
    ├─► $password_hash = "$2y$10$G21sKp8Nnm5qKvKJKjKjJ..."
    │
    ▼ Bcrypt comparison
    ✓ MATCH → Password correct
    
    ├─► Check account_status = 'active'
    ├─► Check is_active = 1
    │
    ▼ Checks pass → Continue to JWT generation
    

┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 6: JWT TOKEN GENERATION                                           │
└─────────────────────────────────────────────────────────────────────────┘

JWTAuthService::generateToken($user)
    │
    ▼
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "user_id": 2,
  "name": "Ahmed Hassan",
  "email": "ahmed@clinic.com",
  "role": "doctor",
  "center_id": 1,
  "iat": 1714942800,                    # Issued at (now)
  "exp": 1715029200                     # Expires at (now + 24h)
}

Secret: env('JWT_SECRET')

    │
    ▼
Encode: base64(Header).base64(Payload).HMAC_SHA256(...)

ACCESS_TOKEN = 
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
 eyJ1c2VyX2lkIjoyLCJuYW1lIjoiQWhtZWQgSGFzc2FuIiwi
 ZW1haWwiOiJhaG1lZEBjbGluaWMuY29tIiwicm9sZSI6ImRvY3R
 vciIsImNlbnRlcl9pZCI6MSwiaWF0IjoxNzE0OTQyODAwLCJleHAi
 OjE3MTUwMjkyMDB9.
 A_zH8K2xJ1mP9kL3qR7vN5sT2yU8wF4gH6jB0cD3eM"

    │
    ├─► Generate REFRESH_TOKEN (7 days validity)
    │
    ▼
MySQL: INSERT INTO refresh_tokens
       (user_id, token, expires_at, created_at)
VALUES (2, 'refresh_token_hash', 
        DATE_ADD(NOW(), INTERVAL 7 DAY),
        NOW());

    │
    ├─► Update user last_login timestamp
    │
    ▼
MySQL: UPDATE users 
       SET last_login = NOW() 
       WHERE id = 2;


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 7: RESPONSE À CLIENT                                              │
└─────────────────────────────────────────────────────────────────────────┘

HTTP 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Authentication successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "name": "Ahmed Hassan",
    "email": "ahmed@clinic.com",
    "role": "doctor",
    "center_id": 1
  },
  "expires_in": 86400,                    # 24 hours in seconds
  "token_type": "Bearer"
}

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 8: CLIENT STORAGE                                                 │
└─────────────────────────────────────────────────────────────────────────┘

Browser JavaScript (websocket.js):
┌──────────────────────────────────────────┐
│ localStorage.setItem(                    │
│   'accessToken',                         │
│   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
│ );                                       │
│                                          │
│ localStorage.setItem(                    │
│   'refreshToken',                        │
│   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
│ );                                       │
│                                          │
│ localStorage.setItem(                    │
│   'user',                                │
│   JSON.stringify({...})                  │
│ );                                       │
│                                          │
│ // Connect to WebSocket                  │
│ const ws = new WebSocket('ws://...');    │
│ ws.send({                                │
│   type: 'user-login',                    │
│   user_id: 2,                            │
│   role: 'doctor',                        │
│   token: accessToken                     │
│ });                                      │
│                                          │
│ // Redirect to dashboard                 │
│ window.location = '/doctor/dashboard';   │
└──────┬───────────────────────────────────┘
       │
       ▼
User is now AUTHENTICATED ✅
```

---

## 📤 FLUX D'UPLOAD D'EXAMEN

### Téléchargement et analyse d'image

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: NAVIGUER VERS PAGE UPLOAD                                      │
└─────────────────────────────────────────────────────────────────────────┘

Admin Dashboard → [New Exam] button
    │
    ▼
GET /exams/new
    │
    ▼ HTML Form
┌───────────────────────────────────────┐
│ New Retinal Exam                      │
├───────────────────────────────────────┤
│ Patient: [Dropdown ▼]                 │
│         └─ Select from center patients
│         └─ Options: Ahmed (ID:1),
│            Fatima (ID:2), ...
│                                       │
│ Eye: [Radio buttons]                  │
│      ○ Left  ○ Right  ○ Both          │
│                                       │
│ Doctor: [Dropdown ▼] (auto-filled)   │
│         └─ Current doctor (Ahmed)     │
│                                       │
│ Upload Image:                         │
│ [Choose File...]                      │
│ Max 10MB, JPG/PNG only                │
│                                       │
│ Notes (optional):                     │
│ [________________]                    │
│                                       │
│ [UPLOAD & ANALYZE]  [CANCEL]         │
└───────┬───────────────────────────────┘
        │
        │ Admin selects:
        │ • Patient: Fatima (ID: 2)
        │ • Eye: Right
        │ • Image: retinal_exam.jpg (2.5MB)
        │
        │ Click [UPLOAD & ANALYZE]
        │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: CLIENT-SIDE VALIDATION                                         │
└─────────────────────────────────────────────────────────────────────────┘

JavaScript Form Handler:
┌──────────────────────────────────────┐
│ document.getElementById('upload')    │
│   .addEventListener('change', (e) => {
│                                      │
│ const file = e.target.files[0];     │
│                                      │
│ // Validate file size                │
│ if (file.size > 10485760) {  // 10MB│
│   alert('File too large');           │
│   return;                            │
│ }                                    │
│                                      │
│ // Validate file type                │
│ if (!['image/jpeg', 'image/png']     │
│      .includes(file.type)) {         │
│   alert('Only JPG/PNG allowed');     │
│   return;                            │
│ }                                    │
│                                      │
│ // Show preview                      │
│ const reader = new FileReader();     │
│ reader.onload = (evt) => {           │
│   $('#preview').attr(               │
│     'src', evt.target.result        │
│   );                                 │
│ };                                   │
│ reader.readAsDataURL(file);          │
│                                      │
│ // Enable submit button              │
│ $('#uploadBtn').disabled = false;    │
│                                      │
│ });                                  │
│                                      │
└──────┬───────────────────────────────┘
       │
       ▼ User clicks [UPLOAD & ANALYZE]
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: SUBMIT MULTIPART REQUEST                                       │
└─────────────────────────────────────────────────────────────────────────┘

POST /api/exams/upload HTTP/1.1
Host: platform.local
Content-Type: multipart/form-data; boundary=----Boundary123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

------Boundary123
Content-Disposition: form-data; name="patient_id"

2
------Boundary123
Content-Disposition: form-data; name="eye"

right
------Boundary123
Content-Disposition: form-data; name="image"; filename="retinal_exam.jpg"
Content-Type: image/jpeg

[BINARY IMAGE DATA - 2.5MB]
------Boundary123--

       │
       │ Request transmitted over HTTPS
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: JWT VALIDATION (MIDDLEWARE)                                    │
└─────────────────────────────────────────────────────────────────────────┘

PHP Middleware: JWTMiddleware.php
┌──────────────────────────────────────┐
│ 1. Extract Authorization header:    │
│    $header = $_SERVER['HTTP_..']    │
│    "Bearer eyJhbGc..."               │
│                                      │
│ 2. Split and get token:             │
│    $token = str_replace(             │
│      'Bearer ', '', $header          │
│    );                                │
│                                      │
│ 3. Validate JWT signature:           │
│    $decoded = JWT::decode(           │
│      $token,                         │
│      env('JWT_SECRET'),              │
│      ['HS256']                       │
│    );                                │
│                                      │
│ 4. Check expiry:                     │
│    if ($decoded->exp < time()) {    │
│      throw 'Token expired';          │
│    }                                 │
│                                      │
│ 5. Extract user data:                │
│    $user_id = $decoded->user_id;    │
│    $role = $decoded->role;           │
│                                      │
│ 6. Store in context for controller: │
│    $_REQUEST['authenticated'] = true;│
│    $_REQUEST['user_id'] = $user_id; │
│    $_REQUEST['role'] = $role;        │
│                                      │
│ ✓ JWT valid → Continue to next step │
└──────┬───────────────────────────────┘
       │
       ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: RBAC CHECK & FILE VALIDATION                                   │
└─────────────────────────────────────────────────────────────────────────┘

ExamController::upload()
┌──────────────────────────────────────┐
│ 1. Check RBAC:                       │
│    if ($role != 'center_admin') {   │
│      return 403 Forbidden;           │
│    }                                 │
│                                      │
│ 2. Get uploaded file:                │
│    $file = $_FILES['image'];         │
│                                      │
│ 3. Validate size:                    │
│    if ($file['size'] > 10485760) {  │
│      return 400 Bad Request;         │
│    }                                 │
│                                      │
│ 4. Check MIME type:                  │
│    $finfo = finfo_open();            │
│    $mime = finfo_file(               │
│      $finfo, $file['tmp_name']      │
│    );                                │
│    if (!in_array(                    │
│      $mime, ['image/jpeg',           │
│               'image/png'])) {       │
│      return 400 Bad Request;         │
│    }                                 │
│                                      │
│ 5. Verify image dimensions:          │
│    $img = getimagesize(              │
│      $file['tmp_name']              │
│    );                                │
│    if ($img[0] < 512 ||              │
│        $img[1] < 512) {              │
│      return 400 Bad Request;         │
│    }                                 │
│                                      │
│ ✓ All validations pass              │
└──────┬───────────────────────────────┘
       │
       ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 6: STORE FILE ON DISK                                             │
└─────────────────────────────────────────────────────────────────────────┘

FileUploadService::save()
┌──────────────────────────────────────┐
│ 1. Generate unique filename:         │
│    $timestamp = time();              │
│    $random = substr(                 │
│      md5(rand()),                    │
│      0, 8                            │
│    );                                │
│    $ext = pathinfo(                  │
│      $file['name'], PATHINFO_EXTENSION
│    );                                │
│                                      │
│    $filename = "exam_{$timestamp}_{$random}.{$ext}"
│    = "exam_1714942800_a1b2c3d4.jpg"  │
│                                      │
│ 2. Define upload directory:          │
│    $uploadDir = '/uploads/exams/';   │
│    Full path: /var/www/html/...$dir  │
│                                      │
│ 3. Move uploaded file:               │
│    move_uploaded_file(               │
│      $file['tmp_name'],              │
│      $uploadDir . $filename          │
│    );                                │
│                                      │
│ 4. Return stored path:               │
│    return [                          │
│      'path' => $filename,            │
│      'full_path' => $uploadDir .     │
│                     $filename,       │
│      'url' => '/uploads/exams/' .    │
│               $filename              │
│    ];                                │
│                                      │
└──────┬───────────────────────────────┘
       │ File saved: /uploads/exams/exam_1714942800_a1b2c3d4.jpg
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 7: CREATE EXAM RECORD IN DATABASE                                 │
└─────────────────────────────────────────────────────────────────────────┘

ExamController::upload() continued

MySQL: INSERT INTO exams
┌──────────────────────────────────────┐
│ INSERT INTO exams (                  │
│   center_id,                         │
│   patient_id,                        │
│   doctor_id,                         │
│   image_path,                        │
│   grade,                             │
│   confidence,                        │
│   eye,                               │
│   notes,                             │
│   created_at                         │
│ ) VALUES (                           │
│   1,              # center_id        │
│   2,              # patient_id       │
│   2,              # doctor_id        │
│   '/uploads/exams/exam_...',        │
│   NULL,           # grade (pending)  │
│   NULL,           # confidence       │
│   'right',        # eye              │
│   NULL,           # notes            │
│   NOW()           # timestamp        │
│ );                                   │
│                                      │
│ $exam_id = mysqli_insert_id();      │
│ $exam_id = 15                        │
│                                      │
└──────┬───────────────────────────────┘
       │ Exam record created: ID = 15
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 8: CALL AI SERVICE FOR PREDICTION                                 │
└─────────────────────────────────────────────────────────────────────────┘

AIClientService::predict()
┌──────────────────────────────────────┐
│ 1. Read image file:                  │
│    $imageContent = file_get_contents(│
│      '/uploads/exams/exam_...'      │
│    );                                │
│                                      │
│ 2. Prepare cURL request:             │
│    $ch = curl_init();                │
│    curl_setopt($ch, CURLOPT_URL,     │
│      'http://localhost:8000/predict' │
│    );                                │
│    curl_setopt($ch,                  │
│      CURLOPT_POST, 1                 │
│    );                                │
│                                      │
│ 3. Build multipart form:             │
│    $post = ['image' =>               │
│      new CURLFile($imagePath)        │
│    ];                                │
│    curl_setopt($ch,                  │
│      CURLOPT_POSTFIELDS, $post       │
│    );                                │
│                                      │
│ 4. Execute request:                  │
│    $response = curl_exec($ch);       │
│    $http_code = curl_getinfo(        │
│      $ch, CURLINFO_HTTP_CODE         │
│    );                                │
│                                      │
│ 5. Parse response:                   │
│    $result = json_decode(            │
│      $response, true                 │
│    );                                │
│                                      │
│ Response: {                          │
│   "grade": 2,                        │
│   "confidence": 87.5,                │
│   "heatmap_path": "/heatmaps/...",  │
│   "overlay_path": "/overlays/..."    │
│ }                                    │
│                                      │
└──────┬───────────────────────────────┘
       │
       ▼ [See FLUX DE PRÉDICTION IA section for details]
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 9: UPDATE EXAM WITH RESULTS                                       │
└─────────────────────────────────────────────────────────────────────────┘

MySQL: UPDATE exams
┌──────────────────────────────────────┐
│ UPDATE exams SET                     │
│   grade = 2,                         │
│   confidence = 87.5,                 │
│   heatmap_path = '/heatmaps/...',   │
│   overlay_path = '/overlays/...'     │
│ WHERE id = 15;                       │
│                                      │
│ Query successful ✓                   │
│                                      │
└──────┬───────────────────────────────┘
       │
       ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 10: CHECK IF ALERT NEEDED                                         │
└─────────────────────────────────────────────────────────────────────────┘

ExamController::upload() continued
┌──────────────────────────────────────┐
│ if ($grade >= 3) {                   │
│   // Grade 3 or 4 = Urgent           │
│   // Create alert                    │
│                                      │
│   MySQL: INSERT INTO alerts (        │
│     exam_id,    # 15                 │
│     doctor_id,  # 2                  │
│     type,       # 'urgent'           │
│     message,    # 'Patient name... ' │
│     is_read,    # 0                  │
│     is_resolved,# 0                  │
│     created_at  # NOW()              │
│   );                                 │
│                                      │
│   $alert_id = 42;                    │
│ }                                    │
│                                      │
│ else {                               │
│   // Grade 0-2 = Normal              │
│   // No alert needed                 │
│ }                                    │
│                                      │
└──────┬───────────────────────────────┘
       │ Grade 2 = No alert needed
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 11: BROADCAST WEBSOCKET EVENT                                     │
└─────────────────────────────────────────────────────────────────────────┘

WebSocketClientService::broadcast()
┌──────────────────────────────────────┐
│ 1. Prepare event data:               │
│    $eventData = [                    │
│      'exam_id' => 15,                │
│      'patient_id' => 2,              │
│      'patient_name' => 'Fatima B.',  │
│      'grade' => 2,                   │
│      'confidence' => 87.5,           │
│      'eye' => 'right',               │
│      'doctor_name' => 'Ahmed H.',    │
│      'created_at' => '2026-05-05...' │
│    ];                                │
│                                      │
│ 2. Call WS server HTTP endpoint:     │
│    POST http://localhost:8080/       │
│        ws/broadcast/exam              │
│                                      │
│    Headers: {                        │
│      'Content-Type': 'application/   │
│                      json',          │
│      'X-Internal-Token': 'secret'    │
│    }                                 │
│                                      │
│    Body: JSON(eventData)             │
│                                      │
│ 3. Node.js receives and broadcasts:  │
│    See FLUX WEBSOCKET section        │
│                                      │
└──────┬───────────────────────────────┘
       │
       ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 12: RETURN SUCCESS RESPONSE                                       │
└─────────────────────────────────────────────────────────────────────────┘

HTTP 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Exam uploaded and analyzed successfully",
  "exam": {
    "id": 15,
    "patient_id": 2,
    "patient_name": "Fatima B.",
    "doctor_id": 2,
    "doctor_name": "Ahmed Hassan",
    "eye": "right",
    "grade": 2,
    "confidence": 87.5,
    "grade_label": "Moderate NPDR",
    "image_url": "/uploads/exams/exam_1714942800_a1b2c3d4.jpg",
    "heatmap_url": "/uploads/heatmaps/exam_1714942800_a1b2c3d4.png",
    "overlay_url": "/uploads/overlays/exam_1714942800_a1b2c3d4.png",
    "created_at": "2026-05-05 14:30:00",
    "alert_created": false
  }
}

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 13: CLIENT HANDLES RESPONSE                                       │
└─────────────────────────────────────────────────────────────────────────┘

JavaScript:
┌──────────────────────────────────────┐
│ fetch('/api/exams/upload', {...})    │
│   .then(resp => resp.json())         │
│   .then(data => {                    │
│                                      │
│   // Show success message            │
│   showNotification(                  │
│     'Exam uploaded successfully!'    │
│   );                                 │
│                                      │
│   // Display results                 │
│   $('#gradeResult').text(            │
│     data.exam.grade_label            │
│   );                                 │
│   $('#confidenceResult').text(       │
│     data.exam.confidence + '%'       │
│   );                                 │
│                                      │
│   // Show heatmap                    │
│   $('#heatmapImage').attr(           │
│     'src', data.exam.heatmap_url     │
│   );                                 │
│                                      │
│   // Redirect to exam details        │
│   setTimeout(() => {                 │
│     window.location = '/exams/' +    │
│       data.exam.id;                  │
│   }, 2000);                          │
│                                      │
│   });                                │
│                                      │
└──────┬───────────────────────────────┘
       │
       ▼ ✅ EXAM UPLOAD COMPLETE
```

---

## ⚠️ FLUX D'ALERTE EN TEMPS RÉEL

### Création et notification d'alerte (Grade >= 3)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CONTEXTE: Exam a été uploadé avec grade = 3 (SEVERE NPDR)               │
└─────────────────────────────────────────────────────────────────────────┘

ExamController::upload() - After prediction
    │
    ├─► grade = 3 → URGENT
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│ STEP 1: CREATE ALERT IN DATABASE                        │
└──────────────────────────────────────────────────────────┘

MySQL: INSERT INTO alerts

{
  "exam_id": 15,
  "doctor_id": 2,
  "type": "urgent",
  "message": "Severe NPDR detected - Patient: Fatima B. (Right eye, 92% confidence)",
  "is_read": 0,
  "is_resolved": 0,
  "created_at": "2026-05-05 14:35:00"
}

Alert ID: 42
    │
    ▼


┌──────────────────────────────────────────────────────────┐
│ STEP 2: BROADCAST TO WEBSOCKET SERVER                   │
└──────────────────────────────────────────────────────────┘

PHP → HTTP POST to Node.js WS Server

POST http://localhost:8080/ws/broadcast/alert
Content-Type: application/json
X-Internal-Token: secret_key

{
  "type": "alert-raised",
  "alert_id": 42,
  "exam_id": 15,
  "doctor_id": 2,
  "grade": 3,
  "patient_name": "Fatima B.",
  "eye": "right",
  "confidence": 92.0,
  "message": "Severe NPDR detected...",
  "priority": "high",
  "timestamp": "2026-05-05 14:35:00"
}

    │
    │ Request over HTTP (internal network)
    │
    ▼


┌──────────────────────────────────────────────────────────┐
│ STEP 3: NODE.JS RECEIVES HTTP POST                       │
└──────────────────────────────────────────────────────────┘

ws-server/src/server.js

app.post('/ws/broadcast/alert', (req, res) => {
    │
    ├─► Validate X-Internal-Token
    │
    ├─► Parse request body
    │   const alertData = req.body;
    │
    ├─► Find all connected clients (WebSocket)
    │
    ▼
});


┌──────────────────────────────────────────────────────────┐
│ STEP 4: FIND RELEVANT DOCTORS                            │
└──────────────────────────────────────────────────────────┘

Node.js Logic:

const connectedClients = {
  'user_2': WebSocket(doctor_ahmed),
  'user_5': WebSocket(doctor_fatima),
  'user_8': WebSocket(admin_center),
  'user_12': WebSocket(doctor_other_center)
};

// Filter doctors from same center
const targetDoctors = connectedClients.filter(client => {
    return client.center_id === alertData.center_id ||
           client.role === 'super_admin';
});

// Result: Send to user_2 (Ahmed), user_5 (Fatima)
    │
    ▼


┌──────────────────────────────────────────────────────────┐
│ STEP 5: BROADCAST WEBSOCKET EVENT                        │
└──────────────────────────────────────────────────────────┘

Node.js: Broadcast to connected WebSocket clients

for each targetDoctor:
    │
    ├─► doctor.ws.send(JSON.stringify({
    │     type: 'alert-raised',
    │     alert_id: 42,
    │     exam_id: 15,
    │     doctor_id: 2,
    │     grade: 3,
    │     patient_name: 'Fatima B.',
    │     eye: 'right',
    │     confidence: 92.0,
    │     message: 'Severe NPDR detected...',
    │     priority: 'high',
    │     timestamp: '2026-05-05 14:35:00',
    │     action_url: '/exams/15'
    │   }));
    │
    ▼


┌──────────────────────────────────────────────────────────┐
│ STEP 6: CLIENT RECEIVES WEBSOCKET MESSAGE                │
└──────────────────────────────────────────────────────────┘

Browser: websocket.js event listener

ws.onmessage = (event) => {
    │
    const msg = JSON.parse(event.data);
    │
    if (msg.type === 'alert-raised') {
        │
        ├─► msgPlayAlert();      // Audio alert
        │
        ├─► showNotification({   // Visual notification
        │     title: 'URGENT ALERT',
        │     message: msg.message,
        │     icon: '/img/alert-icon.png',
        │     priority: msg.priority
        │   });
        │
        ├─► updateDashboard();   // Refresh dashboard
        │
        ├─► incrementAlertBadge();
        │
        └─► addToAlertsList();   // Add to alert list
            │
            ▼
};

    │
    ▼ Doctor's browser shows:
    ┌─────────────────────────────────────┐
    │ 🔴 URGENT ALERT                     │
    ├─────────────────────────────────────┤
    │ Severe NPDR detected                │
    │ Patient: Fatima B.                  │
    │ Right eye, 92% confidence           │
    │ Grade: 3 - SEVERE                   │
    │                                     │
    │ [View Exam] [Dismiss] [Snooze]     │
    └─────────────────────────────────────┘
    
    + Notification sound: DING! DING!
    + Notification badge: Alert count = 1


┌──────────────────────────────────────────────────────────┐
│ STEP 7: QUEUE EMAIL NOTIFICATION                         │
└──────────────────────────────────────────────────────────┘

PHP: After creating alert

EmailService::queueAlert($alert)
    │
    ├─► Get doctor email from database
    │   SELECT email FROM users WHERE id = 2
    │   Result: ahmed@clinic.com
    │
    ├─► Queue email job via Node.js
    │
    ▼
PHP → HTTP POST to Node.js

POST http://localhost:8080/email/send-alert
Content-Type: application/json

{
  "to": "ahmed@clinic.com",
  "doctor_name": "Ahmed Hassan",
  "patient_name": "Fatima B.",
  "grade": 3,
  "grade_label": "Severe NPDR",
  "eye": "right",
  "confidence": 92.0,
  "exam_id": 15,
  "exam_url": "http://platform.local/exams/15"
}

    │
    ▼


┌──────────────────────────────────────────────────────────┐
│ STEP 8: NODE.JS SENDS EMAIL                              │
└──────────────────────────────────────────────────────────┘

ws-server/src/services/email.js

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: env('SMTP_HOST'),      // smtp.gmail.com
  port: env('SMTP_PORT'),      // 587
  secure: true,                 // TLS
  auth: {
    user: env('SMTP_USER'),     // noreply@platform.com
    pass: env('SMTP_PASS')      // password
  }
});

const mailOptions = {
  from: 'DR Screening <noreply@platform.com>',
  to: 'ahmed@clinic.com',
  subject: '⚠️ URGENT: New Severe Case Detected',
  html: `
    <h2>New Urgent Alert</h2>
    <p>Dr. Ahmed Hassan,</p>
    <p>A severe case has been detected:</p>
    <table>
      <tr>
        <td>Patient:</td>
        <td>Fatima B.</td>
      </tr>
      <tr>
        <td>Eye:</td>
        <td>Right</td>
      </tr>
      <tr>
        <td>Grade:</td>
        <td>3 - SEVERE NPDR</td>
      </tr>
      <tr>
        <td>Confidence:</td>
        <td>92%</td>
      </tr>
    </table>
    <p><a href="http://platform.local/exams/15">VIEW EXAM</a></p>
  `
};

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error('Email send error:', err);
    // Retry logic
  } else {
    console.log('Email sent:', info.response);
    // Log to database
  }
});

    │
    ▼ Email transmitted via SMTP/TLS


┌──────────────────────────────────────────────────────────┐
│ STEP 9: DOCTOR RECEIVES EMAIL                            │
└──────────────────────────────────────────────────────────┘

Doctor's Email Inbox:

From: DR Screening <noreply@platform.com>
To: ahmed@clinic.com
Subject: ⚠️ URGENT: New Severe Case Detected

Hi Dr. Ahmed Hassan,

A severe case has been detected:
- Patient: Fatima B.
- Eye: Right
- Grade: 3 - SEVERE NPDR (Severe Non-Proliferative Diabetic Retinopathy)
- Confidence: 92%

[VIEW EXAM DETAILS] ← Click to open in browser

Best regards,
DR Screening Team
    │
    ▼ Doctor clicks [VIEW EXAM DETAILS]
    │


┌──────────────────────────────────────────────────────────┐
│ STEP 10: DOCTOR NAVIGATES TO EXAM                        │
└──────────────────────────────────────────────────────────┘

GET /exams/15

Browser → PHP

ExamController::viewExam($id = 15)
    │
    ├─► Fetch exam from MySQL
    │   SELECT * FROM exams WHERE id = 15
    │
    ├─► Fetch patient details
    │   SELECT * FROM patients WHERE id = exams.patient_id
    │
    ├─► Fetch doctor details
    │   SELECT * FROM users WHERE id = exams.doctor_id
    │
    ├─► Render exam details page
    │
    ▼
HTML Page: /exams/15

┌──────────────────────────────────────────────────────────┐
│ Exam Details - ID: 15                                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Patient: Fatima B. (Age 38)                            │
│ Doctor: Ahmed Hassan                                   │
│ Date: 2026-05-05 14:35                                 │
│                                                          │
│ RESULTS:                                               │
│ Grade: 3 - SEVERE NPDR                                 │
│ Confidence: 92.0%                                      │
│ Eye: Right                                             │
│                                                          │
│ [Original Image]  [Heatmap]  [Overlay]  [Download]    │
│ ┌────────────────────────────────────┐                │
│ │ [Image displays here]              │                │
│ │                                    │                │
│ │ Original retinal fundus image      │                │
│ └────────────────────────────────────┘                │
│                                                          │
│ ┌────────────────────────────────────┐                │
│ │ [Heatmap displays here]            │                │
│ │                                    │                │
│ │ Grad-CAM visualization showing     │                │
│ │ regions of importance              │                │
│ └────────────────────────────────────┘                │
│                                                          │
│ ALERT STATUS:                                          │
│ ⚠️ URGENT ALERT RAISED                                │
│ Alert ID: 42                                           │
│ Status: [UNREAD]                                       │
│ [Mark as Read]  [Resolve]                            │
│                                                          │
│ Doctor Comments:                                       │
│ [_____________________________]                        │
│ [Add Comment]                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘

    │
    ▼ ✅ ALERT WORKFLOW COMPLETE
```

---

## 👨‍⚕️ FLUX DE CRÉATION MÉDECIN

### Processus complet de création et activation

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: ADMIN ACCÈDE AU FORMULAIRE DE CRÉATION                         │
└─────────────────────────────────────────────────────────────────────────┘

Admin Dashboard: Gestion des Médecins
    │
    ▼ [+ New Doctor] button
    │
    ▼
GET /doctors/create

    ▼ HTML Form
┌───────────────────────────────────────────────┐
│ Create New Doctor Account                     │
├───────────────────────────────────────────────┤
│                                               │
│ Identity (National ID/Passport):             │
│ [____________________]                        │ ✓ Required
│                                               │
│ First Name: [____________________]            │ ✓ Required
│ Last Name:  [____________________]            │ ✓ Required
│                                               │
│ Email: [____________________]                 │ ✓ Required
│        └─ Must be unique                      │
│                                               │
│ Phone: [____________________]                 │ ⭕ Optional
│                                               │
│ Specialty: [____________________]             │ ⭕ Optional
│            Ophthalmology / Optometrist / ...  │
│                                               │
│ Address: [____________________]               │ ⭕ Optional
│                                               │
│ [CREATE ACCOUNT]  [CANCEL]                   │
│                                               │
└───────┬───────────────────────────────────────┘
        │ Admin fills form:
        │ Identity: DOC-2026-001
        │ First Name: Fatima
        │ Last Name: Hassan
        │ Email: fatima@clinic.com
        │ Phone: +212-666-777-888
        │ Specialty: Ophthalmology
        │
        │ Click [CREATE ACCOUNT]
        │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: SUBMIT FORM                                                    │
└─────────────────────────────────────────────────────────────────────────┘

POST /api/doctors HTTP/1.1

{
  "identity": "DOC-2026-001",
  "first_name": "Fatima",
  "last_name": "Hassan",
  "email": "fatima@clinic.com",
  "phone": "+212-666-777-888",
  "specialty": "Ophthalmology"
}

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: VALIDATION & VERIFICATION                                      │
└─────────────────────────────────────────────────────────────────────────┘

DoctorController::create()
┌──────────────────────────────────────────────────────────────┐
│ 1. Validate input (format, length, required fields)        │
│    - Identity: not empty, max 50 chars                      │
│    - Names: not empty, max 255 chars                        │
│    - Email: valid format, max 255 chars                     │
│    - Phone: optional, max 20 chars                          │
│    - Specialty: optional, max 100 chars                     │
│                                                            │
│ 2. Check unique email                                       │
│    SELECT COUNT(*) FROM users                              │
│    WHERE email = 'fatima@clinic.com'                       │
│    Result: 0 ✓ (not exists)                                │
│                                                            │
│ 3. Get authenticated user's center_id                       │
│    From JWT payload: center_id = 1                          │
│                                                            │
│ ✓ All validations pass                                      │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: GENERATE JWT ACTIVATION TOKEN                                  │
└─────────────────────────────────────────────────────────────────────────┘

JWTAuthService::generateActivationToken()

{
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "purpose": "account_activation",
  "doctor_email": "fatima@clinic.com",
  "iat": 1714942800,
  "exp": 1714942800 + 86400      # +24 hours
}

Secret: env('JWT_SECRET')

Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

Validity: 24 hours only

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: CREATE USER RECORD IN DATABASE                                 │
└─────────────────────────────────────────────────────────────────────────┘

MySQL: INSERT INTO users

INSERT INTO users (
  center_id,
  role,
  identity,
  name,
  email,
  password_hash,
  speciality,
  phone,
  address,
  is_active,
  account_status,
  activation_token,
  token_expires_at,
  created_at
) VALUES (
  1,                              # center_id
  'doctor',                       # role
  'DOC-2026-001',                 # identity
  'Fatima Hassan',                # concatenated name
  'fatima@clinic.com',            # email
  NULL,                           # password_hash (not yet set)
  'Ophthalmology',                # speciality
  '+212-666-777-888',             # phone
  NULL,                           # address (optional)
  1,                              # is_active = true
  'pending',                      # account_status (awaiting activation)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                  # activation_token
  DATE_ADD(NOW(), INTERVAL 24 HOUR),
                                  # token_expires_at
  NOW()                           # created_at
);

$doctor_id = 5;

    │
    ▼ User created with ID = 5


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 6: PREPARE ACTIVATION EMAIL                                       │
└─────────────────────────────────────────────────────────────────────────┘

EmailService::sendActivationEmail($doctor)

Activation Link: 
https://platform.local/activate?token=eyJhbGc...

Email Subject: "Activez votre compte - DR Screening"

Email Body (HTML Template):

┌──────────────────────────────────────────────────┐
│ Bonjour Dr. Fatima Hassan,                       │
│                                                  │
│ Votre compte a été créé avec succès par          │
│ l'administrateur du centre.                      │
│                                                  │
│ Pour activer votre compte et définir votre       │
│ mot de passe, cliquez sur le lien ci-dessous:   │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ [ACTIVER MON COMPTE]                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Ce lien expire dans 24 heures.                   │
│                                                  │
│ Si vous n'avez pas demandé ce compte,            │
│ veuillez ignorer cet email.                      │
│                                                  │
│ Cordialement,                                    │
│ Équipe DR Screening                              │
└──────────────────────────────────────────────────┘

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 7: SEND EMAIL VIA NODE.JS                                         │
└─────────────────────────────────────────────────────────────────────────┘

PHP → HTTP POST to Node.js

POST http://localhost:8080/email/send-activation
{
  "to": "fatima@clinic.com",
  "doctor_name": "Fatima Hassan",
  "activation_link": "https://platform.local/activate?token=...",
  "token_expiry": "24 hours"
}

    │
    ├─► Node.js Nodemailer sends email
    │
    ▼ Email delivered to: fatima@clinic.com


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 8: RETURN SUCCESS RESPONSE                                        │
└─────────────────────────────────────────────────────────────────────────┘

HTTP 200 OK

{
  "success": true,
  "message": "Doctor account created successfully",
  "doctor": {
    "id": 5,
    "identity": "DOC-2026-001",
    "name": "Fatima Hassan",
    "email": "fatima@clinic.com",
    "specialty": "Ophthalmology",
    "account_status": "pending",
    "created_at": "2026-05-05 14:40:00"
  },
  "notification": "Activation email sent to fatima@clinic.com"
}

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 9: DOCTOR RECEIVES EMAIL & CLICKS LINK                            │
└─────────────────────────────────────────────────────────────────────────┘

Doctor's Email Inbox:

From: DR Screening <noreply@platform.com>
To: fatima@clinic.com
Subject: Activez votre compte - DR Screening

[Email content as shown above]

Doctor clicks: [ACTIVER MON COMPTE]

    │
    ▼
Browser navigates to:
GET /activate?token=eyJhbGc...

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 10: DISPLAY ACTIVATION FORM                                       │
└─────────────────────────────────────────────────────────────────────────┘

GET /activate?token=...

PHP validates token:
- Extract from URL: $token = $_GET['token']
- Decode JWT
- Check expiry: exp > time()
- Check not already activated

If valid:

HTML Form:
┌──────────────────────────────────────┐
│ Activate Your Account                │
├──────────────────────────────────────┤
│                                      │
│ Welcome Dr. Fatima Hassan!           │
│                                      │
│ Please set your password:            │
│                                      │
│ New Password:                        │
│ [____________________]               │
│ ✓ Min 8 characters                   │
│ ✓ Must include uppercase             │
│ ✓ Must include number                │
│ ✓ Must include special char          │
│                                      │
│ Confirm Password:                    │
│ [____________________]               │
│                                      │
│ ☐ I agree to Terms of Service       │
│                                      │
│ [ACTIVATE]  [CANCEL]                │
│                                      │
└──────┬───────────────────────────────┘
       │
       │ Doctor enters:
       │ Password: Secure@Pass123
       │ Confirm: Secure@Pass123
       │ Agrees to ToS
       │
       │ Click [ACTIVATE]
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 11: ACTIVATE ACCOUNT                                              │
└─────────────────────────────────────────────────────────────────────────┘

POST /api/activate

{
  "token": "eyJhbGc...",
  "password": "Secure@Pass123",
  "confirm_password": "Secure@Pass123"
}

    │
    ▼

AuthController::activate()
┌──────────────────────────────────────────────────────────────┐
│ 1. Validate token                                            │
│    • Extract from request                                    │
│    • Decode JWT                                              │
│    • Check signature                                         │
│    • Check expiry                                            │
│                                                             │
│ 2. Get user from database                                    │
│    SELECT * FROM users                                       │
│    WHERE activation_token = $token                           │
│                                                             │
│ 3. Check not already activated                              │
│    if (account_status == 'active') {                        │
│      return 400 'Already activated';                        │
│    }                                                         │
│                                                             │
│ 4. Validate password                                         │
│    • Min 8 chars                                             │
│    • Contains uppercase: [A-Z]                              │
│    • Contains lowercase: [a-z]                              │
│    • Contains number: [0-9]                                 │
│    • Contains special: [@#$%^&*!]                           │
│    • Password != confirm_password → 400 error              │
│                                                             │
│ 5. Hash password with bcrypt                                │
│    $password_hash = password_hash(                          │
│      $password,                                             │
│      PASSWORD_BCRYPT,                                       │
│      ['cost' => 10]                                         │
│    );                                                        │
│                                                             │
│ 6. Update user record                                        │
│    UPDATE users SET                                          │
│      password_hash = $password_hash,                        │
│      account_status = 'active',                             │
│      activation_token = NULL,                               │
│      token_expires_at = NULL                                │
│    WHERE id = $user_id;                                     │
│                                                             │
│ 7. Clear any old refresh tokens                             │
│    DELETE FROM refresh_tokens                               │
│    WHERE user_id = $user_id;                                │
│                                                             │
└──────┬───────────────────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 12: SUCCESS & REDIRECT                                            │
└─────────────────────────────────────────────────────────────────────────┘

HTTP 200 OK

{
  "success": true,
  "message": "Account activated successfully",
  "redirect": "/login",
  "notification": "You can now log in with your email and password"
}

    │
    ▼ Browser redirects to: /login
    │


┌─────────────────────────────────────────────────────────────────────────┐
│ ÉTAPE 13: DOCTOR LOGS IN                                                │
└─────────────────────────────────────────────────────────────────────────┘

Login Form:
Email: fatima@clinic.com
Password: Secure@Pass123

Click [LOGIN]

    │
    ▼ [See FLUX D'AUTHENTIFICATION for login process]
    │
    ▼ Doctor accesses dashboard ✅
```

---

## 🤖 FLUX DE PRÉDICTION IA

### Processus complet d'analyse d'image par le service IA

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CONTEXTE: PHP a appelé FastAPI avec l'image rétinienne                 │
└─────────────────────────────────────────────────────────────────────────┘

PHP sends: POST http://localhost:8000/predict
with: multipart/form-data (image binary)

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: FASTAPI RECEIVES REQUEST                                        │
└─────────────────────────────────────────────────────────────────────────┘

FastAPI (main.py):
from fastapi import FastAPI, UploadFile, File
import uvicorn

app = FastAPI()

@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    """
    Receive image, run inference, return predictions
    """
    │
    ├─► Receive uploaded image
    │   image.filename = "exam_1714942800_a1b2c3d4.jpg"
    │   image.content_type = "image/jpeg"
    │   image.size = 2621440  # ~2.5MB
    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: IMAGE VALIDATION                                                │
└─────────────────────────────────────────────────────────────────────────┘

Python validation:
┌──────────────────────────────────────────────────┐
│ # Read image bytes                               │
│ image_bytes = await image.read()                 │
│                                                  │
│ # Validate MIME type                             │
│ if image.content_type not in [                   │
│   'image/jpeg', 'image/png'                      │
│ ]:                                               │
│   return {"error": "Invalid file type"}          │
│                                                  │
│ # Validate size                                  │
│ if len(image_bytes) > 10 * 1024 * 1024:         │
│   return {"error": "File too large"}             │
│                                                  │
│ # Load image                                     │
│ import io, PIL                                   │
│ img = Image.open(io.BytesIO(image_bytes))       │
│                                                  │
│ # Validate dimensions                            │
│ width, height = img.size                         │
│ if width < 512 or height < 512:                 │
│   return {"error": "Image too small"}            │
│                                                  │
│ # Validate color (must be RGB or RGBA)          │
│ if img.mode not in ['RGB', 'RGBA', 'L']:        │
│   img = img.convert('RGB')                       │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │ ✓ Image valid
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: PREPROCESSING                                                   │
└─────────────────────────────────────────────────────────────────────────┘

Python preprocessing pipeline:
┌──────────────────────────────────────────────────┐
│ from torchvision import transforms              │
│ import numpy as np                               │
│                                                  │
│ # Define preprocessing                          │
│ preprocess = transforms.Compose([                │
│   transforms.Resize((224, 224)),                 │
│   transforms.ToTensor(),                         │
│   transforms.Normalize(                          │
│     mean=[0.485, 0.456, 0.406],  # ImageNet    │
│     std=[0.229, 0.224, 0.225]    # ImageNet    │
│   )                                              │
│ ])                                               │
│                                                  │
│ # Convert PIL image to tensor                    │
│ tensor = preprocess(img)                         │
│ # Output shape: (3, 224, 224)                    │
│                                                  │
│ # Create batch                                   │
│ batch = tensor.unsqueeze(0)                      │
│ # Output shape: (1, 3, 224, 224)                 │
│                                                  │
│ # Move to GPU if available                       │
│ if torch.cuda.is_available():                    │
│   batch = batch.to('cuda')                       │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: LOAD MODELS                                                     │
└─────────────────────────────────────────────────────────────────────────┘

Python model loading:
┌──────────────────────────────────────────────────┐
│ import torch                                      │
│ import torch.nn as nn                             │
│ from torchvision import models                    │
│                                                  │
│ device = torch.device(                           │
│   'cuda' if torch.cuda.is_available() else 'cpu' │
│ )                                                │
│                                                  │
│ # Load ResNet50                                  │
│ resnet = models.resnet50(pretrained=False)      │
│ resnet.fc = nn.Linear(2048, 5)  # 5 classes    │
│ resnet.load_state_dict(                          │
│   torch.load('models/resnet_model.pth')         │
│ )                                                │
│ resnet.to(device)                                │
│ resnet.eval()                                    │
│                                                  │
│ # Load EfficientNet-B3                           │
│ effnet_b3 = models.efficientnet_b3(             │
│   pretrained=False                               │
│ )                                                │
│ effnet_b3.classifier[1] = nn.Linear(1536, 5)   │
│ effnet_b3.load_state_dict(                       │
│   torch.load('models/efficientnet_b3.pth')      │
│ )                                                │
│ effnet_b3.to(device)                             │
│ effnet_b3.eval()                                 │
│                                                  │
│ # Load EfficientNet-B4                           │
│ effnet_b4 = models.efficientnet_b4(             │
│   pretrained=False                               │
│ )                                                │
│ effnet_b4.classifier[1] = nn.Linear(1792, 5)   │
│ effnet_b4.load_state_dict(                       │
│   torch.load('models/efficientnet_b4.pth')      │
│ )                                                │
│ effnet_b4.to(device)                             │
│ effnet_b4.eval()                                 │
│                                                  │
│ print("✓ Models loaded successfully")            │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: TEST-TIME AUGMENTATION (TTA)                                    │
└─────────────────────────────────────────────────────────────────────────┘

Python TTA logic:
┌──────────────────────────────────────────────────┐
│ import torchvision.transforms.functional as F   │
│                                                  │
│ # 5 augmentations for robustness                 │
│ augmentations = [                                │
│   lambda x: x,  # Original                       │
│   lambda x: torch.fliplr(x),  # Horizontal flip  │
│   lambda x: torch.flipud(x),  # Vertical flip    │
│   lambda x: F.rotate(x, 15),  # Rotate +15°      │
│   lambda x: F.rotate(x, -15)  # Rotate -15°      │
│ ]                                                │
│                                                  │
│ predictions_list = []                            │
│                                                  │
│ with torch.no_grad():                            │
│   for aug_fn in augmentations:                   │
│     aug_batch = aug_fn(batch)                    │
│                                                  │
│     # Forward through ResNet                    │
│     logits_res = resnet(aug_batch)              │
│     probs_res = torch.softmax(logits_res, 1)   │
│     predictions_list.append(                    │
│       probs_res.cpu().numpy()[0]                │
│     )                                            │
│                                                  │
│     # Forward through EfficientNet-B3           │
│     logits_eff3 = effnet_b3(aug_batch)          │
│     probs_eff3 = torch.softmax(logits_eff3, 1) │
│     predictions_list.append(                    │
│       probs_eff3.cpu().numpy()[0]               │
│     )                                            │
│                                                  │
│     # Forward through EfficientNet-B4           │
│     logits_eff4 = effnet_b4(aug_batch)          │
│     probs_eff4 = torch.softmax(logits_eff4, 1) │
│     predictions_list.append(                    │
│       probs_eff4.cpu().numpy()[0]               │
│     )                                            │
│                                                  │
│ # Average all predictions                       │
│ avg_predictions = np.mean(                       │
│   predictions_list, axis=0                       │
│ )                                                │
│                                                  │
│ # Probabilities for each class                  │
│ # avg_predictions = [0.02, 0.15, 0.72, 0.08, 0.03]
│                                                  │
└──────┬───────────────────────────────────────────┘
       │ Predictions after TTA: [0.02, 0.15, 0.72, 0.08, 0.03]
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: SOFT VOTING (ENSEMBLE)                                          │
└─────────────────────────────────────────────────────────────────────────┘

Python ensemble voting:
┌──────────────────────────────────────────────────┐
│ # Learned ensemble weights (from validation)     │
│ ensemble_weights = {                             │
│   'resnet': 0.3,                                 │
│   'efficientnet_b3': 0.35,                       │
│   'efficientnet_b4': 0.35                        │
│ }                                                │
│                                                  │
│ # Get individual model predictions (avg across  │
│ # 5 augmentations)                               │
│ avg_predictions_resnet = np.mean(                │
│   predictions_list[0:5], axis=0                  │
│ )                                                │
│ # [0.01, 0.12, 0.71, 0.10, 0.06]                 │
│                                                  │
│ avg_predictions_eff3 = np.mean(                  │
│   predictions_list[5:10], axis=0                 │
│ )                                                │
│ # [0.02, 0.18, 0.73, 0.05, 0.02]                 │
│                                                  │
│ avg_predictions_eff4 = np.mean(                  │
│   predictions_list[10:15], axis=0                │
│ )                                                │
│ # [0.03, 0.15, 0.72, 0.08, 0.02]                 │
│                                                  │
│ # Weighted average                               │
│ ensemble_pred = (                                │
│   0.3 * avg_predictions_resnet +                 │
│   0.35 * avg_predictions_eff3 +                  │
│   0.35 * avg_predictions_eff4                    │
│ ) / (0.3 + 0.35 + 0.35)                          │
│                                                  │
│ # Result                                         │
│ ensemble_pred ≈ [0.02, 0.15, 0.72, 0.08, 0.03]  │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: TEMPERATURE SCALING (CALIBRATION)                               │
└─────────────────────────────────────────────────────────────────────────┘

Python temperature scaling:
┌──────────────────────────────────────────────────┐
│ # Pre-computed calibration temperature           │
│ T = 1.32  # Optimized on validation set         │
│                                                  │
│ # Apply temperature scaling                      │
│ logits = np.log(ensemble_pred + 1e-10)          │
│ scaled_logits = logits / T                       │
│ calibrated_probs = softmax(scaled_logits)       │
│                                                  │
│ # Before calibration:                            │
│ # ensemble_pred = [0.02, 0.15, 0.72, 0.08, 0.03]
│                                                  │
│ # After calibration:                             │
│ # calibrated_probs ≈ [0.01, 0.12, 0.74, 0.10, 0.03]
│                                                  │
│ # More reliable confidence!                      │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 8: PREDICT CLASS                                                   │
└─────────────────────────────────────────────────────────────────────────┘

Python class prediction:
┌──────────────────────────────────────────────────┐
│ # Get predicted class (max probability)          │
│ predicted_class = np.argmax(calibrated_probs)   │
│ # predicted_class = 2                            │
│                                                  │
│ predicted_confidence = calibrated_probs[2]      │
│ # predicted_confidence ≈ 0.74                    │
│                                                  │
│ # Grade mapping (classes 0-4)                    │
│ grade_labels = {                                 │
│   0: "No DR",                                    │
│   1: "Mild NPDR",                                │
│   2: "Moderate NPDR",                            │
│   3: "Severe NPDR",                              │
│   4: "Proliferative DR"                          │
│ }                                                │
│                                                  │
│ predicted_grade = predicted_class  # 2           │
│ predicted_label = grade_labels[2]  # "Moderate NPDR"
│ confidence_percent = 74.0  # 0.74 * 100          │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 9: GENERATE GRAD-CAM VISUALIZATION                                 │
└─────────────────────────────────────────────────────────────────────────┘

Python Grad-CAM:
┌──────────────────────────────────────────────────┐
│ import cv2                                        │
│                                                  │
│ # Get Grad-CAM from ResNet (best quality)       │
│ def get_gradcam(model, input_tensor, class_idx):
│                                                  │
│   # Register hook on last conv layer            │
│   last_conv = model.layer4[2].conv3              │
│   activations = []                               │
│   gradients = []                                 │
│                                                  │
│   def forward_hook(module, input, output):      │
│     activations.append(output)                   │
│                                                  │
│   def backward_hook(module, grad_in, grad_out): │
│     gradients.append(grad_out[0])                │
│                                                  │
│   f_hook = last_conv.register_forward_hook(     │
│     forward_hook                                 │
│   )                                              │
│   b_hook = last_conv.register_backward_hook(    │
│     backward_hook                                │
│   )                                              │
│                                                  │
│   # Forward pass                                 │
│   logits = model(input_tensor)                   │
│   score = logits[0, class_idx]                   │
│                                                  │
│   # Backward pass                                │
│   model.zero_grad()                              │
│   score.backward()                               │
│                                                  │
│   # Compute Grad-CAM                             │
│   activations = activations[-1][0].detach()    │
│   gradients = gradients[-1][0].detach()          │
│                                                  │
│   # Weight by gradient                           │
│   weights = torch.mean(gradients, (1, 2))      │
│   weighted_activation = (                        │
│     weights.view(-1, 1, 1) * activations        │
│   ).sum(dim=0)                                   │
│                                                  │
│   # Apply ReLU & normalize                       │
│   cam = F.relu(weighted_activation)             │
│   cam = cam / (cam.max() + 1e-10)                │
│                                                  │
│   # Upsample to 224x224                          │
│   cam = F.interpolate(                           │
│     cam.unsqueeze(0).unsqueeze(0),              │
│     (224, 224),                                  │
│     mode='bilinear'                              │
│   )                                              │
│                                                  │
│   return cam[0, 0].cpu().numpy()                │
│                                                  │
│ # Get Grad-CAM heatmap                           │
│ heatmap = get_gradcam(                           │
│   resnet, batch, class_idx=2                     │
│ )                                                │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 10: CREATE VISUALIZATIONS                                          │
└─────────────────────────────────────────────────────────────────────────┘

Python visualization:
┌──────────────────────────────────────────────────┐
│ import matplotlib.cm as cm                        │
│ import numpy as np                                │
│                                                  │
│ # Load original image (rescaled to 224x224)     │
│ original_img = np.array(img.resize((224, 224))) │
│ original_img = original_img / 255.0              │
│                                                  │
│ # Apply colormap to heatmap                      │
│ heatmap_colored = cm.jet(heatmap)[:, :, :3]    │
│                                                  │
│ # Create overlay                                 │
│ overlay = (                                      │
│   0.6 * original_img +                           │
│   0.4 * heatmap_colored                          │
│ )                                                │
│                                                  │
│ # Save heatmap                                   │
│ heatmap_img = (heatmap_colored * 255).astype(   │
│   np.uint8                                        │
│ )                                                │
│ cv2.imwrite(                                     │
│   '/heatmaps/exam_1714942800_a1b2c3d4.png',    │
│   cv2.cvtColor(heatmap_img, cv2.COLOR_RGB2BGR)  │
│ )                                                │
│                                                  │
│ # Save overlay                                   │
│ overlay_img = (overlay * 255).astype(np.uint8)  │
│ cv2.imwrite(                                     │
│   '/overlays/exam_1714942800_a1b2c3d4.png',    │
│   cv2.cvtColor(overlay_img, cv2.COLOR_RGB2BGR)  │
│ )                                                │
│                                                  │
└──────┬───────────────────────────────────────────┘
       │


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 11: RETURN PREDICTION RESPONSE                                     │
└─────────────────────────────────────────────────────────────────────────┘

HTTP 200 OK
Content-Type: application/json

{
  "success": true,
  "prediction": {
    "grade": 2,
    "grade_label": "Moderate NPDR",
    "confidence": 74.0,
    "probabilities": {
      "0_no_dr": 0.01,
      "1_mild": 0.12,
      "2_moderate": 0.74,
      "3_severe": 0.10,
      "4_proliferative": 0.03
    }
  },
  "visualizations": {
    "heatmap_path": "/heatmaps/exam_1714942800_a1b2c3d4.png",
    "overlay_path": "/overlays/exam_1714942800_a1b2c3d4.png"
  },
  "model_info": {
    "ensemble_type": "soft_voting",
    "models_used": ["ResNet50", "EfficientNet-B3", "EfficientNet-B4"],
    "tta_augmentations": 5,
    "temperature_scaling": 1.32,
    "inference_time_ms": 1240
  },
  "processing_time_ms": 1240
}

    │
    ▼ Response sent back to PHP
```

---

## 📊 FLUX DE TABLEAU DE BORD

### Real-time dashboard update flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: DOCTOR OPENS DASHBOARD                                          │
└─────────────────────────────────────────────────────────────────────────┘

Doctor navigates to: /doctor/dashboard

    │
    ▼

GET /doctor/dashboard
    │
    ├─► PHP renders page with initial data:
    │   - Recent exams (last 10)
    │   - Patient count
    │   - Alert count
    │   - Statistics
    │
    ▼ HTML Page loads in browser with JavaScript


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: WEBSOCKET CONNECTION ESTABLISHED                                │
└─────────────────────────────────────────────────────────────────────────┘

Browser JavaScript (websocket.js):

const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // Send login message to WS server
  ws.send(JSON.stringify({
    type: 'user-login',
    user_id: 2,
    role: 'doctor',
    center_id: 1,
    token: localStorage.getItem('accessToken')
  }));
};

    │
    ▼ Connection established


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: LISTEN FOR REAL-TIME EVENTS                                     │
└─────────────────────────────────────────────────────────────────────────┘

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'alert-raised':
      // Handle new alert
      updateAlertsList(msg);
      incrementAlertBadge();
      showNotification(msg);
      playAlertSound();
      break;
      
    case 'exam-created':
      // Handle new exam
      addExamToList(msg);
      updateExamCount();
      break;
      
    case 'stats-update':
      // Handle dashboard stats update
      updateKPIs(msg);
      updateCharts(msg);
      break;
      
    case 'user-online':
      // Handle user presence
      updateUserStatus(msg);
      break;
  }
};

    │
    ▼ WebSocket listening for events


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: INITIAL DASHBOARD DATA FETCH                                    │
└─────────────────────────────────────────────────────────────────────────┘

JavaScript initialization:

document.addEventListener('DOMContentLoaded', () => {
  // Fetch initial dashboard data
  fetch('/api/dashboard/stats', {
    headers: {
      'Authorization': 'Bearer ' + 
        localStorage.getItem('accessToken')
    }
  })
  .then(r => r.json())
  .then(data => {
    // Update dashboard KPIs
    $('#totalPatients').text(data.total_patients);
    $('#totalExams').text(data.total_exams);
    $('#alertCount').text(data.unread_alerts);
    $('#urgentCount').text(data.urgent_cases);
    
    // Update charts
    updateChart('gradesDistribution', 
      data.grades_distribution);
  });
  
  // Fetch exams list
  fetch('/api/exams?limit=20', {
    headers: {
      'Authorization': 'Bearer ' + 
        localStorage.getItem('accessToken')
    }
  })
  .then(r => r.json())
  .then(data => {
    renderExamsList(data.exams);
  });
});

    │
    ▼ Dashboard displayed with initial data


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: AUTO-REFRESH TIMER                                              │
└─────────────────────────────────────────────────────────────────────────┘

JavaScript interval:

// Auto-refresh stats every 30 seconds
setInterval(() => {
  fetch('/api/dashboard/stats', {...})
    .then(r => r.json())
    .then(data => {
      // Only update if changed
      if (data.alert_count !== 
          parseInt($('#alertCount').text())) {
        $('#alertCount').text(data.alert_count);
        $('#alertCount').addClass('changed');
      }
    });
}, 30000);  // 30 seconds

    │
    ▼ Periodic refresh


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 6: EVENT TRIGGERS DASHBOARD UPDATE                                 │
└─────────────────────────────────────────────────────────────────────────┘

Example: New exam upload by another doctor

PHP (admin) uploads exam
    │
    ├─► ExamController creates exam record
    │
    ├─► Calls WebSocketClientService::broadcast()
    │   POST /ws/broadcast/exam
    │
    ▼ Node.js receives HTTP POST
    │
    ├─► Broadcasts to all connected doctors
    │   event: 'exam-created'
    │   data: {exam_id, patient_name, grade, etc}
    │
    ▼ Browser receives WebSocket message
    │
    ├─► Calls JavaScript function: addExamToList()
    │
    ├─► Inserts new row in exams table
    │
    ├─► Updates exam count
    │
    ├─► If grade >= 3: triggers alert workflow
    │
    ▼ Dashboard refreshed in real-time


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: INTERACTIVE DASHBOARD FEATURES                                  │
└─────────────────────────────────────────────────────────────────────────┘

Doctor interactions:

1. Search/Filter Exams
   Input: search box
   Event: 'keyup' with debounce
   
   JavaScript:
   $('#searchBox').on('keyup', 
    debounce(() => {
     const query = $('#searchBox').val();
     filterExamsClient(query);  // Client-side
    }, 300)
   );

2. Sort Exams
   Click: column header
   Event: sort table
   
   JavaScript:
   $('#tableHeader').on('click', (e) => {
     const column = e.target.dataset.column;
     sortExamsClient(column);  // Client-side
   });

3. View Alert
   Click: alert in list
   Event: navigate to exam
   
   JavaScript:
   $('#alertsList').on('click', 'a', (e) => {
     const exam_id = e.target.dataset.examId;
     fetch(`/api/alerts/${alertId}/read`, 
       {method: 'PUT'})
       .then(() => {
         window.location = `/exams/${exam_id}`;
       });
   });

4. Dismiss Alert
   Click: dismiss button
   Event: POST to backend
   
   JavaScript:
   $('#dismissAlert').on('click', () => {
     fetch(`/api/alerts/${alertId}/dismiss`,
       {method: 'PUT'})
       .then(() => {
         removeFromList();
       });
   });

    │
    ▼


┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 8: DISCONNECT/RECONNECT HANDLING                                   │
└─────────────────────────────────────────────────────────────────────────┘

WebSocket disconnect/reconnect:

ws.onclose = () => {
  console.log('WebSocket disconnected');
  showNotification('Connection lost', 'warning');
  
  // Attempt to reconnect after 5 seconds
  setTimeout(() => {
    reconnectWebSocket();
  }, 5000);
};

function reconnectWebSocket() {
  ws = new WebSocket('ws://localhost:8080/ws');
  ws.onopen = () => {
    console.log('Reconnected');
    // Re-login
    ws.send(JSON.stringify({
      type: 'user-login',
      user_id: 2,
      role: 'doctor'
    }));
    // Refresh all data
    location.reload();
  };
}

    │
    ▼ Automatic reconnection
```

---

Tous les flux complets sont documentés avec détails granulaires, timestamps, états de base de données, et transitions d'état. Le document [FLUX_COMPLETS.md](FLUX_COMPLETS.md) a été créé avec succès!
