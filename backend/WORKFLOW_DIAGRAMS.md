# Doctor Account Activation - Visual Workflow Guide

## 🔄 Complete Workflow Diagram

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    DOCTOR ACCOUNT ACTIVATION WORKFLOW                      ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CENTER ADMIN CREATES ACCOUNT                                        │
└─────────────────────────────────────────────────────────────────────────────┘

    Admin Dashboard
    ┌─────────────────────┐
    │ Create Doctor Form   │
    ├─────────────────────┤
    │ Identity: DOC-12345 │  ✅ Required
    │ First Name: Ahmed   │  ✅ Required
    │ Last Name: Hassan   │  ✅ Required
    │ Email: a@email.com  │  ✅ Required
    │ Phone: 212-XXX-XXX  │  ⭕ Optional
    │ Specialty: Phthalmology  │  ⭕ Optional
    │ [Create Account]    │
    └─────────────────────┘
            │
            │ POST /api/doctors
            ▼
    ┌─────────────────────────────────────────┐
    │ System Processing                       │
    ├─────────────────────────────────────────┤
    │ 1. Validate inputs                      │
    │ 2. Generate 24-hour JWT token           │
    │ 3. Create user record                   │
    │    - account_status = 'pending'         │
    │    - activation_token = JWT             │
    │    - password_hash = NULL               │
    │ 4. Send activation email                │
    │ 5. Return success response              │
    └─────────────────────────────────────────┘
            │
            ▼
    ✅ Success: "Email sent to a@email.com"

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: DOCTOR RECEIVES ACTIVATION EMAIL                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    Email Inbox
    ┌─────────────────────────────────────────────────┐
    │ From: noreply@drscreening.com                   │
    │ Subject: Activez votre compte - DR Screening    │
    │                                                 │
    │ Bonjour Ahmed Hassan,                           │
    │ Votre compte a été créé avec succès.            │
    │ Cliquez ci-dessous pour activer votre compte:   │
    │                                                 │
    │ ┌───────────────────────────────┐               │
    │ │ Activer Mon Compte            │  ← Link       │
    │ └───────────────────────────────┘               │
    │ (http://localhost:3000/activate/JWT_TOKEN)     │
    │                                                 │
    │ Ce lien expire dans 24 heures.                  │
    └─────────────────────────────────────────────────┘
            │
            │ Doctor clicks link
            ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: FRONTEND VERIFIES ACTIVATION TOKEN                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    Browser loads: http://localhost:3000/activate/JWT_TOKEN
            │
            │ JavaScript extracts token from URL
            │
            ▼
    GET /api/auth/activation-status/JWT_TOKEN
            │
            ▼
    ┌──────────────────────────────┐
    │ System Verification          │
    ├──────────────────────────────┤
    │ ✓ Token signature valid      │
    │ ✓ Token not expired (< 24h)  │
    │ ✓ User record found          │
    │ ✓ Status is "pending"        │
    └──────────────────────────────┘
            │
            ▼
    ✅ Response:
    {
      "valid": true,
      "email": "a@email.com",
      "name": "Ahmed Hassan"
    }
            │
            ▼
    Frontend shows password form

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: DOCTOR SETS PASSWORD                                                │
└─────────────────────────────────────────────────────────────────────────────┘

    Password Setup Form
    ┌────────────────────────────────────┐
    │ Welcome, Ahmed Hassan!             │
    │                                    │
    │ Set Your Password                  │
    ├────────────────────────────────────┤
    │ Password:        [SecurePass123!]  │
    │ Confirm Password:[SecurePass123!]  │
    │                                    │
    │ [Activate Account & Login]         │
    └────────────────────────────────────┘
            │
            │ POST /api/auth/activate
            ▼
    ┌────────────────────────────────────┐
    │ Payload:                           │
    │ {                                  │
    │   activation_token: "JWT...",      │
    │   password: "SecurePass123!",      │
    │   password_confirm: "SecurePass123!│
    │ }                                  │
    └────────────────────────────────────┘
            │
            ▼
    ┌────────────────────────────────────┐
    │ System Processing:                 │
    │ 1. Verify activation token         │
    │ 2. Validate password:              │
    │    - Length >= 6 characters        │
    │    - Matches confirmation          │
    │ 3. Hash password with bcryptjs     │
    │ 4. Update user record:             │
    │    - password_hash = bcrypt(...)   │
    │    - account_status = 'active'     │
    │    - activation_token = NULL       │
    │    - token_expires_at = NULL       │
    │ 5. Generate login JWT              │
    └────────────────────────────────────┘
            │
            ▼
    ✅ Response:
    {
      "success": true,
      "message": "Compte activé avec succès",
      "data": {
        "access_token": "eyJhbGc...",
        "expires_at": "2026-05-05T10:30:00Z"
      }
    }
            │
            ▼
    🔐 Doctor is now LOGGED IN!

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: DOCTOR CAN NOW LOGIN                                                │
└─────────────────────────────────────────────────────────────────────────────┘

    Login Form
    ┌───────────────────────────────┐
    │ Email: a@email.com            │
    │ Password: [SecurePass123!]    │
    │ [Login]                       │
    └───────────────────────────────┘
            │
            │ POST /api/auth/login
            ▼
    ┌───────────────────────────────┐
    │ System Check:                 │
    │ ✓ Email exists                │
    │ ✓ Password matches            │
    │ ✓ account_status = 'active'   │
    │ ✓ Account not inactive        │
    └───────────────────────────────┘
            │
            ▼
    ✅ Login successful!
    🎉 Doctor can now use platform
```

---

## 📊 Account Status State Machine

```
    ┌─────────────────┐
    │   NEW USER      │
    │                 │
    │ No account yet  │
    └────────┬────────┘
             │
             │ Admin creates account
             │ POST /api/doctors
             ▼
    ╔═════════════════════╗
    ║   PENDING STATUS    ║
    ║                     ║
    ║  account_status:    ║
    ║  'pending'          ║
    ║                     ║
    ║  ❌ Cannot login    ║
    ║  ✅ Email sent      ║
    ║  ✅ Token valid 24h ║
    ╚════════════╤════════╝
                 │
        ┌────────┴────────┐
        │                 │
        │ Activation URL  │
        │ clicked by doc  │
        │                 │
        ├─────────────────┤
        │                 │
        │ Password set    │
        │ via activation  │
        │ link            │
        ▼                 ▼
    ╔═════════════╗   ╔═════════════════════╗
    ║ ACTIVE      ║   ║  TOKEN EXPIRED      ║
    ║             ║   ║  (24h passed)       ║
    ║  account_   ║   ║                     ║
    ║  status:    ║   ║  ❌ Cannot activate ║
    ║  'active'   ║   ║  🔄 Must recreate   ║
    ║             ║   ║     account         ║
    ║  ✅ Can     ║   └────────────────────┘
    ║     login   ║
    ║  ✅ Full    ║
    ║     access  ║
    ╚═════╤═══════╝
          │
          │ Admin deactivates
          │ (optional)
          ▼
    ╔═════════════════════╗
    ║   INACTIVE STATUS   ║
    ║                     ║
    ║  account_status:    ║
    ║  'inactive'         ║
    ║                     ║
    ║  ❌ Cannot login    ║
    ║  ⏸️  Suspended      ║
    ║  🔄 Wait for admin  ║
    ╚═════════════════════╝
```

---

## 🔐 Token Lifecycle

```
Timeline (24 hours)
├──────────────────────────────────────────────────────────────────┤
0h                                                                24h
│                                                                  │
TOKEN CREATED                                              TOKEN EXPIRES
├─────────────────────────────────┬───────────────────────────────┤
                                  │
                            Within 24h:
                            Doctor activates
                            ✅ Account activated
                            Token cleared
                            Cannot reuse
                            
                            After 24h:
                            ❌ Token rejected
                            Doctor must request new


JWT Token Structure:
┌────────────────────────────────────────────────────────────────┐
│ Header: {"alg": "HS256", "typ": "JWT"}                        │
├────────────────────────────────────────────────────────────────┤
│ Payload:                                                       │
│ {                                                              │
│   "user_email": "a@email.com",                                │
│   "action": "account_activation",                             │
│   "iat": 1714834200,      (issued at)                         │
│   "exp": 1714920600       (expires at - 24 hours later)       │
│ }                                                              │
├────────────────────────────────────────────────────────────────┤
│ Signature: HMAC-SHA256(header + payload, ACTIVATION_SECRET)   │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Request/Response Flow

```
SCENARIO 1: Create Doctor Account
═════════════════════════════════════════════════════════════

REQUEST:
POST /api/doctors
Authorization: Bearer admin_token
Content-Type: application/json

{
  "identity": "ID-123456",
  "first_name": "Ahmed",
  "last_name": "Hassan",
  "email": "ahmed@example.com",
  "phone": "212612345678",
  "specialty": "Ophtalmologie"
}

RESPONSE (201):
{
  "success": true,
  "data": {
    "id": 5,
    "email": "ahmed@example.com",
    "name": "Ahmed Hassan",
    "identity": "ID-123456",
    "account_status": "pending",
    "specialty": "Ophtalmologie",
    "created_at": "2026-05-04T10:30:00Z"
  },
  "message": "Compte créé. Email envoyé.",
  "activation_email_sent": true
}


SCENARIO 2: Check Token Validity
═════════════════════════════════════════════════════════════

REQUEST:
GET /api/auth/activation-status/eyJhbGc...

RESPONSE (200 - Valid):
{
  "success": true,
  "valid": true,
  "data": {
    "email": "ahmed@example.com",
    "name": "Ahmed Hassan"
  }
}

RESPONSE (401 - Invalid/Expired):
{
  "success": false,
  "valid": false,
  "error": "Lien d'activation invalide ou expiré"
}


SCENARIO 3: Activate Account & Set Password
═════════════════════════════════════════════════════════════

REQUEST:
POST /api/auth/activate
Content-Type: application/json

{
  "activation_token": "eyJhbGc...",
  "password": "SecurePass123",
  "password_confirm": "SecurePass123"
}

RESPONSE (200):
{
  "success": true,
  "message": "Compte activé avec succès",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2026-05-04T18:30:00Z"
  }
}

ERROR RESPONSE (400):
{
  "success": false,
  "error": "Les mots de passe ne correspondent pas"
}

ERROR RESPONSE (401):
{
  "success": false,
  "error": "Lien d'activation invalide ou expiré"
}


SCENARIO 4: Login After Activation
═════════════════════════════════════════════════════════════

REQUEST:
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "SecurePass123"
}

RESPONSE (200):
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "token": "eyJhbGc...",
    "expires_at": "2026-05-04T18:30:00Z",
    "user": {
      "id": 5,
      "email": "ahmed@example.com",
      "name": "Ahmed Hassan",
      "role": "doctor",
      "center_id": 1
    }
  }
}

ERROR RESPONSE (403 - Not Activated):
{
  "success": false,
  "error": "Compte en attente d'activation. Vérifiez votre email."
}
```

---

## 🔄 Frontend Component Flow

```
App Router
├── /admin/doctors/create ──→ CreateDoctorForm
│                              ├── Input: identity
│                              ├── Input: first_name
│                              ├── Input: last_name
│                              ├── Input: email
│                              ├── Input: phone (optional)
│                              └── Input: specialty (optional)
│
├── /activate/:token ──→ ActivationPage
│                        ├── Check token validity
│                        │   GET /api/auth/activation-status/:token
│                        │
│                        ├── IF valid:
│                        │   └── Show PasswordForm
│                        │       ├── Display doctor name
│                        │       ├── Input: password
│                        │       ├── Input: password_confirm
│                        │       └── Submit button
│                        │
│                        └── IF invalid:
│                            └── Show error message
│
└── /login ──→ LoginForm
                ├── Input: email
                ├── Input: password
                └── Submit button
```

---

## ⚠️ Error Handling Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     ERROR SCENARIOS                              │
└─────────────────────────────────────────────────────────────────┘

Create Doctor:
├── Missing required fields → 400 Bad Request
├── Email already exists → 400 Conflict
├── Invalid doctor_code format → 400 Bad Request
└── Server error → 500 Internal Server Error

Check Token:
├── Token signature invalid → 401 Unauthorized
├── Token expired (> 24h) → 401 Unauthorized
├── User not found → 404 Not Found
└── Account already activated → 400 Bad Request

Activate Account:
├── Token missing → 400 Bad Request
├── Password too short → 400 Bad Request
├── Password confirmation mismatch → 400 Bad Request
├── Token invalid/expired → 401 Unauthorized
├── User not found → 404 Not Found
├── Account already active → 400 Bad Request
└── Server error → 500 Internal Server Error

Login:
├── Email not found → 401 Unauthorized
├── Password incorrect → 401 Unauthorized
├── Account pending activation → 403 Forbidden
├── Account inactive → 403 Forbidden
└── Center inactive → 403 Forbidden
```

---

## 🎯 Quick Lookup Table

| What | Where | Status |
|------|-------|--------|
| Create account | `/api/doctors` | POST |
| Check token | `/api/auth/activation-status/:token` | GET |
| Activate account | `/api/auth/activate` | POST |
| Login | `/api/auth/login` | POST |
| Change password | `/api/auth/change-password` | POST |

| Requirement | Field | Type | Required |
|-------------|-------|------|----------|
| ID Number | `identity` | String | ✅ Yes |
| First Name | `first_name` | String | ✅ Yes |
| Last Name | `last_name` | String | ✅ Yes |
| Email | `email` | String | ✅ Yes |
| Phone | `phone` | String | ⭕ No |
| Specialty | `specialty` | String | ⭕ No |
| Password | `password` | String | ❌ No (in create) |

---

**Last Updated:** 2026-05-04
**Visual Guide Version:** 1.0
