# Doctor Account Creation & Activation Workflow

## Overview

The administrator is now responsible for creating doctor accounts with specific information. The system generates a unique, secure activation link that the doctor uses to set their own password. This ensures secure account setup without administrators handling passwords.

## Workflow Steps

### 1. Administrator Creates Doctor Account

The center administrator navigates to **Admin Panel → Médecins → Nouveau médecin** and provides:

- **Prénom (First Name)** - Doctor's first name (required)
- **Nom (Last Name)** - Doctor's last name (required)
- **Email** - Doctor's email address (required, must be unique)
- **N° d'Identité (Identity Number)** - National ID, passport, or professional license number (required)
- **Téléphone (Phone)** - Doctor's phone number (optional)
- **Adresse (Address)** - Doctor's physical address (optional)
- **Spécialité (Specialty)** - Professional specialty, default: "Ophtalmologie" (optional)
- **Rôle (Role)** - Fixed to "Médecin" (Doctor) (read-only)

### 2. System Generates Activation Link

When the administrator submits the form:

1. **Account Created** - A new user account is created with status `pending`
2. **Activation Token Generated** - A JWT token is created with:
   - Payload: `{ user_email, action: 'account_activation' }`
   - Secret: `ACTIVATION_SECRET` (from environment)
   - Expiration: 24 hours
3. **Activation Link Generated** - URL format: `http://APP_URL/activate/{TOKEN}`
4. **Email Sent** - Doctor receives email with:
   - Personalized greeting
   - Activation link (clickable button)
   - Plain text URL (as fallback)
   - Security warning about 24-hour expiration
   - Instructions to set password

### 3. Doctor Receives Activation Email

The doctor receives a formatted HTML email with:
- Clear instructions for account activation
- Clickable activation button
- Fallback text URL
- Warning about token expiration (24 hours)

**Email Template Elements:**
- Professional branding (DR Screening)
- Urgency indicators
- Clear call-to-action button
- Helpful instructions

### 4. Doctor Activates Account

Doctor clicks the activation link or enters it in browser:

1. **Page Loads** - Activation page displays with:
   - Password creation form
   - Real-time password strength indicator
   - Password confirmation field
   - Security tips
   - 24-hour expiration notice

2. **Password Requirements:**
   - Minimum 6 characters
   - Strong password recommended (uppercase, lowercase, numbers, symbols)
   - Real-time strength indicator shows: Weak → Medium → Strong

3. **Password Validation:**
   - Passwords must match
   - Minimum length enforced
   - Confirmation field required

4. **Account Activation:**
   - Password is hashed using bcryptjs
   - Account status changes from `pending` → `active`
   - Activation token cleared
   - Token expiration cleared
   - Doctor can now log in

### 5. Doctor Logs In

Once activated, doctor can:
1. Navigate to login page
2. Enter email and password
3. Access doctor dashboard

## Database Changes

### Users Table Addition

```sql
ALTER TABLE users ADD COLUMN address TEXT DEFAULT NULL COMMENT 'Address (for doctors)' AFTER speciality;
```

### Fields Modified/Added

- **address** - NEW field for doctor's physical address
- **identity** - Used for national ID, passport, or professional number
- **activation_token** - Stores JWT token for account activation
- **token_expires_at** - Expiration timestamp (24 hours from creation)
- **account_status** - States: `pending`, `active`, `inactive`

## API Endpoints

### Create Doctor Account
```
POST /api/doctors
Content-Type: application/json

{
  "email": "doctor@example.com",
  "identity": "AB123456",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+212 6XX XXX XXX",
  "address": "123 Medical Street, City",
  "specialty": "Ophtalmologie"
}

Response (201 Created):
{
  "success": true,
  "data": {
    "id": 42,
    "email": "doctor@example.com",
    "name": "John Doe",
    "identity": "AB123456",
    "phone": "+212 6XX XXX XXX",
    "address": "123 Medical Street, City",
    "specialty": "Ophtalmologie",
    "account_status": "pending",
    "created_at": "2026-05-04T12:00:00Z"
  },
  "message": "Compte créé avec succès. Un email d'activation a été envoyé au docteur.",
  "activation_email_sent": true
}
```

### Activate Account (Set Password)
```
POST /api/auth/activate
Content-Type: application/json

{
  "activation_token": "eyJhbGc...",
  "password": "SecureP@ss123",
  "password_confirm": "SecureP@ss123"
}

Response (200 OK):
{
  "success": true,
  "message": "Compte activé avec succès",
  "data": {
    "access_token": "eyJhbGc...",
    "token": "eyJhbGc...",
    "expires_at": "2026-05-04T20:00:00Z",
    "user": {
      "id": 42,
      "email": "doctor@example.com",
      "name": "John Doe",
      "role": "doctor",
      "center_id": 1
    }
  }
}
```

## Frontend Components

### Doctor Management Form (`/center/doctors`)

**New Fields:**
- Identity number input (required)
- Phone number input (optional)
- Address textarea (optional)
- Specialty input (pre-filled)
- Role dropdown (read-only, fixed to "doctor")

**Form Behavior:**
- Admin does NOT set password during creation
- Password is set by doctor via activation link
- Edit mode allows updating all fields except account_status
- Table shows account status (pending/active/inactive)

### Activation Page (`/activate/{token}`)

**Features:**
- Clean, responsive design
- Real-time password strength indicator
- Password confirmation matching
- Error handling and validation
- Success screen with redirect to login
- 24-hour expiration warning

**States:**
- Form: User enters password
- Loading: Activation in progress
- Success: Account activated, redirect option
- Error: Display error message with retry option

## Security Features

1. **Token Security:**
   - Signed JWT tokens (ACTIVATION_SECRET)
   - 24-hour expiration
   - One-time use (cleared after successful activation)
   - HMAC-SHA256 signature

2. **Password Security:**
   - Minimum 6 characters required
   - bcryptjs hashing (salted)
   - Never stored in plain text
   - Strength indicator recommends strong passwords

3. **Email Security:**
   - Activation link sent via email
   - Token-based verification
   - Cannot activate without valid token
   - Token expires after 24 hours

4. **Account Status:**
   - Pending accounts cannot log in
   - Login checks account_status before allowing access
   - Inactive accounts are blocked

## Environment Variables

```bash
# Application URL for activation links
APP_URL=http://localhost:3000

# JWT Secrets
JWT_SECRET=your-jwt-secret-key
ACTIVATION_SECRET=your-activation-secret-key
JWT_EXPIRY=8h

# SMTP Configuration for email sending
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME=DR Screening
```

## Error Handling

### Token Validation Errors
- **Invalid Token**: "Lien d'activation invalide ou expiré"
- **Expired Token**: "Lien d'activation invalide ou expiré"
- **Already Activated**: "Ce compte a déjà été activé"

### Password Validation Errors
- **Too Short**: "Le mot de passe doit contenir au moins 6 caractères"
- **Mismatch**: "Les mots de passe ne correspondent pas"
- **Missing**: "Mot de passe requis"

### Form Validation Errors
- **Missing Fields**: "Email, identité, prénom et nom sont requis"
- **Duplicate Email**: "Cet email est déjà utilisé"

## Testing the Workflow

### Step 1: Create Doctor Account
1. Log in as center administrator
2. Go to Médecins section
3. Click "Nouveau médecin"
4. Fill in the form with test data:
   - Name: Dr. Test Doctor
   - Email: test.doctor@example.com
   - Identity: AB123456
   - Phone: +212 6XX XXX XXX
   - Address: 123 Test Street
5. Click "Enregistrer"
6. Verify: Success message and activation email sent

### Step 2: Check Email
1. Open email client (check development email service)
2. Find email from "DR Screening"
3. Click activation link or copy URL

### Step 3: Activate Account
1. Page loads with password form
2. Enter password (e.g., "TestPass123!")
3. Watch strength indicator change
4. Confirm password
5. Click "Activer mon compte"
6. See success message
7. Click "Aller à la connexion"

### Step 4: Log In
1. On login page, enter:
   - Email: test.doctor@example.com
   - Password: TestPass123!
2. Click login
3. Verify: Doctor dashboard loads

## Troubleshooting

### Activation Email Not Received
1. Check SMTP configuration in .env
2. Verify email in spam/junk folder
3. Check email logs in application
4. Ensure APP_URL is correctly set

### Token Expired
1. Admin must create new doctor account
2. New activation link will be generated
3. Old token becomes invalid

### Can't Activate Account
1. Verify token is from the email link
2. Check that 24 hours haven't passed
3. Verify network connectivity
4. Clear browser cache

### Can't Log In After Activation
1. Verify account status is "active" (in database)
2. Check password is correct
3. Verify email matches
4. Check center status is "active"

## Database Queries

### Check Doctor Account Status
```sql
SELECT id, email, name, identity, account_status, 
       activation_token, token_expires_at, created_at
FROM users
WHERE role = 'doctor' AND email = 'doctor@example.com';
```

### Find Pending Activations
```sql
SELECT id, email, name, account_status, token_expires_at
FROM users
WHERE role = 'doctor' AND account_status = 'pending'
ORDER BY created_at DESC;
```

### Check Expired Tokens
```sql
SELECT id, email, name, token_expires_at
FROM users
WHERE role = 'doctor' AND account_status = 'pending'
AND token_expires_at < NOW();
```

## Summary

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Admin | Create doctor account | Account created, email sent |
| 2 | System | Generate token | JWT token created (24h expiry) |
| 3 | Doctor | Receives email | Clicks activation link |
| 4 | Doctor | Sets password | Password hashed, account activated |
| 5 | Doctor | Logs in | Access to dashboard |

---

**Document Version:** 1.0  
**Created:** May 4, 2026  
**Last Updated:** May 4, 2026
