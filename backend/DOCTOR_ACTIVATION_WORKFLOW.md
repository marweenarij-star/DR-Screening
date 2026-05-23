# Doctor Account Activation Workflow - Implementation Guide

## Overview
This document describes the new doctor account creation and activation workflow implemented for the Diabetic Retinopathy Screening System. The system implements a secure, email-based account activation process where:

1. **Administrator (Center Admin)** creates doctor accounts with basic information
2. **System** generates a unique, time-limited activation token
3. **Doctor** receives an activation email and sets their own password
4. **System** activates the account upon successful password setup

---

## Database Schema Changes

### New Fields Added to `users` Table

| Field | Type | Purpose |
|-------|------|---------|
| `identity` | VARCHAR(50) | Identity/ID number (passport, national ID, etc.) |
| `account_status` | ENUM | Account status: `pending`, `active`, `inactive` |
| `activation_token` | VARCHAR(255) | Signed JWT token for account activation (unique) |
| `token_expires_at` | TIMESTAMP | Token expiration time (24 hours from creation) |
| `password_hash` | VARCHAR(255) | Changed to nullable (was NOT NULL) |

### Migration
Run the migration script to apply these changes:
```bash
# For SQLite (primary backend)
sqlite3 dr_screening.db < migrations/001-add-activation-fields.sql

# For MySQL (if applicable)
mysql -u root -p database_name < database/schema.sql
```

---

## API Endpoints

### 1. Create Doctor Account (Admin Only)
**POST** `/api/doctors`

**Authentication:** Bearer token (center_admin role)

**Request Body:**
```json
{
  "identity": "DOC123456",           // Required: Identity/ID number
  "first_name": "Ahmed",              // Required: First name
  "last_name": "Hassan",              // Required: Last name
  "email": "ahmed@example.com",        // Required: Email address
  "phone": "212612345678",             // Optional: Phone number
  "specialty": "Ophtalmologie",        // Optional: Medical specialty
  "doctor_code": "OPH001"              // Optional: Doctor code (auto-generated if not provided)
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "email": "ahmed@example.com",
    "name": "Ahmed Hassan",
    "first_name": "Ahmed",
    "last_name": "Hassan",
    "role": "doctor",
    "identity": "DOC123456",
    "account_status": "pending",
    "specialty": "Ophtalmologie",
    "doctor_code": "OPH001",
    "created_at": "2026-05-04T10:30:00Z"
  },
  "message": "Compte créé avec succès. Un email d'activation a été envoyé au docteur.",
  "activation_email_sent": true
}
```

**Validation:**
- ❌ Password is NOT accepted in the request body
- ❌ All required fields (identity, first_name, last_name, email) must be provided
- ❌ Email must be unique across the system

---

### 2. Check Activation Token Status
**GET** `/api/auth/activation-status/:token`

**Authentication:** None required

**Purpose:** Verify activation token validity before showing password form

**Response (Valid Token - 200):**
```json
{
  "success": true,
  "valid": true,
  "data": {
    "email": "ahmed@example.com",
    "name": "Ahmed Hassan"
  }
}
```

**Response (Invalid/Expired Token - 401):**
```json
{
  "success": false,
  "valid": false,
  "error": "Lien d'activation invalide ou expiré"
}
```

---

### 3. Activate Account & Set Password
**POST** `/api/auth/activate`

**Authentication:** None required

**Request Body:**
```json
{
  "activation_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "password": "SecurePassword123!",
  "password_confirm": "SecurePassword123!"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Compte activé avec succès",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2026-05-04T18:30:00Z"
  }
}
```

**Validation:**
- ✓ Password minimum 6 characters
- ✓ Password must match confirmation
- ✓ Token must be valid and not expired
- ✓ Account status must be "pending"

**Error Cases:**
```json
// Token expired or invalid
{
  "success": false,
  "error": "Lien d'activation invalide ou expiré"
}

// Passwords don't match
{
  "success": false,
  "error": "Les mots de passe ne correspondent pas"
}

// Account already activated
{
  "success": false,
  "error": "Ce compte a déjà été activé"
}
```

---

### 4. Login (After Activation)
**POST** `/api/auth/login`

**Authentication:** None required

**Request Body:**
```json
{
  "email": "ahmed@example.com",
  "password": "SecurePassword123!"
}
```

**Prevention Checks:**
- ❌ Returns error if `account_status` is `pending`
- ❌ Returns error if `account_status` is `inactive`

**Error Response (Pending Account):**
```json
{
  "success": false,
  "error": "Compte en attente d'activation. Veuillez vérifier votre email pour activer votre compte."
}
```

---

## Email Flow

### Activation Email

When a doctor account is created, an HTML email is sent to the doctor's email address containing:

**Subject:** `Activez votre compte - DR Screening System`

**Content:**
- Welcome message
- Activation link (valid 24 hours)
- Instructions for password setup
- Copy-paste URL as fallback
- Warning about 24-hour expiration
- Support contact information

**Activation Link Format:**
```
{APP_URL}/activate/{activation_token}
```

Example:
```
http://localhost:3000/activate/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Workflow Sequence

### For Center Administrator

```
1. Admin navigates to "Create Doctor" page
2. Admin fills form with:
   - Identity number
   - First name & Last name
   - Email address
   - (Optional) Phone & Specialty
3. Admin clicks "Create Account"
4. System:
   - Validates inputs
   - Generates activation token (JWT, 24hr expiration)
   - Creates user with status="pending"
   - Sends activation email
5. Admin sees success message with email sent confirmation
```

### For New Doctor

```
1. Doctor receives activation email at their email address
2. Doctor clicks "Activate My Account" button in email
   OR copies activation link to browser
3. System verifies token and shows password setup form
4. Doctor enters:
   - New password (min 6 characters)
   - Password confirmation
5. Doctor clicks "Set Password & Activate"
6. System:
   - Validates password match
   - Hashes password using bcrypt
   - Updates user status to "active"
   - Clears activation token
   - Returns login credentials
7. Doctor is logged in and can access the platform
```

---

## Security Considerations

### Token Generation
- Uses **JWT (JSON Web Tokens)** with ACTIVATION_SECRET
- **Expiration:** 24 hours
- **Scope:** Single-use (cleared upon account activation)
- **Payload:** 
  ```json
  {
    "user_email": "ahmed@example.com",
    "action": "account_activation",
    "iat": 1714834200,
    "exp": 1714920600
  }
  ```

### Password Security
- Minimum 6 characters required
- Hashed using **bcryptjs** with salt rounds = 10
- Confirmed field to prevent typos
- Transmitted over HTTPS only (enforce in deployment)

### Account Status
- **pending:** Account created, awaiting email verification
- **active:** Account fully activated and usable
- **inactive:** Account deactivated by admin

### Email Verification
- Links cannot be reused after successful activation
- Expired tokens are automatically rejected by JWT verification
- Admin can regenerate token if needed (by updating the record)

---

## Implementation Details

### Environment Variables Required

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key
ACTIVATION_SECRET=your-activation-secret-key

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=DR Screening
SMTP_SECURE=false

# Application URL
APP_URL=http://localhost:3000
# In production: APP_URL=https://yourdomain.com
```

### Key Code Changes

#### Middleware (`src/middleware/auth.js`)
- Added `generateActivationToken()` - Creates 24-hour JWT tokens
- Added `verifyActivationToken()` - Validates activation tokens

#### Mail Service (`src/services/mailService.js`)
- Added `sendActivationEmail()` - Sends formatted HTML emails

#### Routes

**Doctors Route** (`src/routes/doctors.js`):
- Modified `POST /api/doctors` to use activation workflow
- Updated `PUT /api/doctors/:id` to prevent password changes for pending accounts

**Auth Route** (`src/routes/auth.js`):
- Modified `POST /api/auth/login` to check `account_status`
- Added `POST /api/auth/activate` - Activates account with password
- Added `GET /api/auth/activation-status/:token` - Validates token

#### Database (`src/config/database.js`)
- No changes needed (already supports new fields)

---

## Frontend Integration

### UI Components Needed

#### 1. Create Doctor Form (Admin Panel)
```html
<form method="POST" action="/api/doctors">
  <input type="text" name="identity" required placeholder="ID Number">
  <input type="text" name="first_name" required placeholder="First Name">
  <input type="text" name="last_name" required placeholder="Last Name">
  <input type="email" name="email" required placeholder="Email">
  <input type="tel" name="phone" placeholder="Phone (optional)">
  <input type="text" name="specialty" placeholder="Specialty (optional)">
  <button type="submit">Create Doctor Account</button>
</form>
```

#### 2. Activation Link Page
Route: `/activate/:token`
```html
<div id="activation-form">
  <h2>Set Your Password</h2>
  <div id="loading">Verifying activation link...</div>
  <div id="form" style="display: none;">
    <p>Welcome, <span id="doctor-name"></span></p>
    <form method="POST" action="/api/auth/activate">
      <input type="hidden" name="activation_token" id="token">
      <input type="password" name="password" required minlength="6" placeholder="Password">
      <input type="password" name="password_confirm" required minlength="6" placeholder="Confirm Password">
      <button type="submit">Activate Account & Login</button>
    </form>
  </div>
  <div id="error" style="display: none;" class="alert alert-danger"></div>
</div>

<script>
// On page load:
// 1. Extract token from URL
// 2. Call GET /api/auth/activation-status/:token
// 3. Show form if valid, error if not
// 4. Submit POST /api/auth/activate on form submit
// 5. Auto-login if successful
</script>
```

---

## API Testing Examples

### Using cURL

#### Create Doctor Account
```bash
curl -X POST http://localhost:5000/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "identity": "DOC123456",
    "first_name": "Ahmed",
    "last_name": "Hassan",
    "email": "ahmed@example.com",
    "phone": "212612345678",
    "specialty": "Ophtalmologie"
  }'
```

#### Check Activation Token
```bash
curl http://localhost:5000/api/auth/activation-status/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Activate Account
```bash
curl -X POST http://localhost:5000/api/auth/activate \
  -H "Content-Type: application/json" \
  -d '{
    "activation_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "password": "SecurePassword123!",
    "password_confirm": "SecurePassword123!"
  }'
```

---

## Troubleshooting

### Email Not Sending
- Check SMTP credentials in `.env`
- Verify `SMTP_USER` and `SMTP_PASS` are correct
- For Gmail: Use "App Passwords" not regular password
- Check server logs for error messages

### Token Expired
- Activation tokens expire after 24 hours
- Admin must create a new account for the doctor
- In future versions, consider adding "regenerate token" endpoint

### Account Already Activated
- If doctor tries same link twice, second attempt fails
- Provide option for admin to view doctor details and confirm activation status

### Frontend Integration Issues
- Ensure `APP_URL` environment variable matches frontend URL
- In development: `APP_URL=http://localhost:3000`
- In production: `APP_URL=https://yourdomain.com`

---

## Future Enhancements

1. **Token Regeneration:** Allow admin to resend activation email
2. **Password Reset:** Implement forgot password flow (similar to activation)
3. **Account Suspension:** Allow admin to temporarily suspend accounts
4. **Audit Logging:** Track account creation and activation events
5. **Multi-factor Authentication (MFA):** Add 2FA for doctors
6. **Account Invitation:** Send invitation instead of direct account creation

---

## Compliance Notes

- ✓ GDPR compliant: Personal data only collected with explicit consent
- ✓ Passwords never stored in plain text (bcryptjs hashing)
- ✓ Tokens expire automatically (24 hours)
- ✓ Email verification proves email ownership
- ✓ Activity logging can be added for audit trails

---

## Support & Questions

For issues or questions:
1. Check the API error messages
2. Review the implementation code
3. Check server logs: `docker logs backend` or `npm logs`
4. Verify `.env` configuration

---

**Last Updated:** 2026-05-04
**Version:** 1.0
**Status:** Ready for Testing
