# Doctor Account Activation - Quick Reference

## What Changed?

### Before (Old System)
```
Admin → Creates Doctor Account → System generates temp password
         → Doctor receives password via email or in admin panel
         → Doctor logs in with temp password
         → Doctor forced to change password
```

### After (New System) ✨
```
Admin → Creates Doctor Account → System generates activation token
        (provides: identity, name, role, email)    → Doctor receives activation link
                                                    → Doctor sets own password
                                                    → Doctor activates & logs in
```

---

## New API Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/doctors` | Create new doctor account | Admin |
| GET | `/api/auth/activation-status/:token` | Check if activation link is valid | None |
| POST | `/api/auth/activate` | Set password & activate account | None |
| POST | `/api/auth/login` | Login (updated to block pending accounts) | None |

---

## Required Input Fields for Doctor Creation

When admin creates a doctor account, provide:

✅ **Required:**
- `identity` - ID/Passport number
- `first_name` - Doctor's first name
- `last_name` - Doctor's last name  
- `email` - Email address (receives activation link)

✅ **Optional:**
- `phone` - Phone number
- `specialty` - Medical specialty
- `doctor_code` - Doctor code (auto-generated if not provided)

❌ **NOT ACCEPTED:**
- `password` - System will NOT accept this; doctor sets password via email link

---

## Account Status Values

| Status | Meaning | Can Login? |
|--------|---------|-----------|
| `pending` | Waiting for doctor to activate | ❌ No |
| `active` | Account activated & ready to use | ✅ Yes |
| `inactive` | Admin deactivated the account | ❌ No |

---

## Activation Email Flow

1. **Admin creates doctor account**
2. **System sends email containing:**
   - Unique activation link (valid 24 hours)
   - Instructions to set password
   - Support contact info
3. **Doctor clicks link**
4. **Doctor sets password** (min 6 characters)
5. **Account is activated** & doctor can login

---

## Key Fields Added to Database

```sql
-- New columns in 'users' table:
identity VARCHAR(50)                    -- ID number
account_status ENUM('pending','active','inactive')  -- Account status
activation_token VARCHAR(255)           -- Unique token for activation
token_expires_at TIMESTAMP              -- Token expiration (24 hours)
password_hash VARCHAR(255) DEFAULT NULL -- Changed to nullable
```

---

## Important Notes

⚠️ **Token Expiration:** Activation links expire after **24 hours**
- If doctor doesn't activate in time, admin must create account again
- Consider adding "regenerate token" feature later

⚠️ **Security:**
- Passwords hashed with bcryptjs
- Tokens are signed JWTs with automatic verification
- Email required - proves email ownership

⚠️ **Admin Panel:**
- Remove password input field from doctor creation form
- Don't show generated passwords anymore
- Show activation email confirmation

---

## Environment Variables Needed

Add these to `.env`:

```env
# Token security
ACTIVATION_SECRET=your-secret-key-for-activation-tokens

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend URL (for email links)
APP_URL=http://localhost:3000
```

---

## Testing the Workflow

### Step 1: Create Doctor Account
```bash
curl -X POST http://localhost:5000/api/doctors \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identity": "ID12345",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  }'
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "email": "john@example.com",
    "account_status": "pending",
    "name": "John Doe"
  },
  "message": "Compte créé avec succès. Un email d'activation a été envoyé au docteur."
}
```

### Step 2: Doctor Receives Email & Clicks Link
Email contains: `http://localhost:3000/activate/{TOKEN}`

### Step 3: Verify Token (Frontend)
```bash
curl http://localhost:5000/api/auth/activation-status/{TOKEN}
```

Expected Response:
```json
{
  "success": true,
  "valid": true,
  "data": {
    "email": "john@example.com",
    "name": "John Doe"
  }
}
```

### Step 4: Doctor Activates Account
```bash
curl -X POST http://localhost:5000/api/auth/activate \
  -H "Content-Type: application/json" \
  -d '{
    "activation_token": "{TOKEN}",
    "password": "SecurePass123",
    "password_confirm": "SecurePass123"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Compte activé avec succès",
  "data": {
    "access_token": "eyJ...",
    "expires_at": "2026-05-04T18:30:00Z"
  }
}
```

### Step 5: Doctor Logs In
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

---

## Migration Steps

1. **Backup Database**
   ```bash
   cp dr_screening.db dr_screening.db.backup
   ```

2. **Apply Migration**
   ```bash
   sqlite3 dr_screening.db < migrations/001-add-activation-fields.sql
   ```

3. **Verify Columns Added**
   ```bash
   sqlite3 dr_screening.db ".schema users"
   ```

4. **Update Frontend** (if needed)
   - Remove password field from doctor creation form
   - Add activation page at `/activate/:token`
   - Update admin dashboard to show account status

5. **Update `.env` File**
   - Add `ACTIVATION_SECRET`
   - Add `APP_URL`
   - Verify email settings

6. **Restart Backend**
   ```bash
   npm run dev
   # or
   node src/server.js
   ```

---

## Error Messages (For Frontend)

| Scenario | Error Message |
|----------|---------------|
| Token expired | "Lien d'activation invalide ou expiré" |
| Password too short | "Le mot de passe doit contenir au moins 6 caractères" |
| Passwords don't match | "Les mots de passe ne correspondent pas" |
| Account already activated | "Ce compte a déjà été activé" |
| Pending account login | "Compte en attente d'activation. Veuillez vérifier votre email pour activer votre compte." |

---

## Files Modified/Created

```
✏️  Modified:
├── database/schema.sql                    (Added new columns)
├── backend/src/middleware/auth.js         (Added token generation)
├── backend/src/routes/auth.js             (Added activation endpoints)
├── backend/src/routes/doctors.js          (Updated creation flow)
└── backend/src/services/mailService.js    (Added email sending)

✨ Created:
├── backend/migrations/001-add-activation-fields.sql
└── backend/DOCTOR_ACTIVATION_WORKFLOW.md  (Full documentation)
```

---

## Support
For detailed information, see: `backend/DOCTOR_ACTIVATION_WORKFLOW.md`

**Implementation Date:** 2026-05-04
**Status:** ✅ Ready for Testing
