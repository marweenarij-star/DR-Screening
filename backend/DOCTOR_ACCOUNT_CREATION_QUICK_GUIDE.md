# Doctor Account Creation - Quick Reference Guide

## For Administrators

### Creating a New Doctor Account

1. **Login** → Go to Admin Dashboard
2. **Navigate** → Click "Médecins" in sidebar
3. **Create** → Click "Nouveau médecin" button
4. **Fill Form** with:
   - ✅ **Prénom** (First Name) - Required
   - ✅ **Nom** (Last Name) - Required
   - ✅ **Email** - Required, must be unique
   - ✅ **N° d'Identité** - Required (ID/Passport/License)
   - ℹ️ **Téléphone** - Optional
   - ℹ️ **Adresse** - Optional
   - ℹ️ **Spécialité** - Optional (defaults to Ophtalmologie)
   - 🔒 **Rôle** - Fixed to "Médecin"
5. **Submit** → Click "Enregistrer"
6. **Confirm** → Success message appears
7. **Email Sent** → Activation link sent automatically

### What the Doctor Receives

An email with:
- Personalized greeting
- Clickable activation button
- Instructions to create password
- ⏰ **Important:** 24-hour expiration warning
- Fallback URL if button doesn't work

---

## For Doctors

### Activating Your Account

1. **Check Email** - Look for message from "DR Screening"
2. **Click Link** - Click "Activer Mon Compte" button (or copy URL)
3. **Create Password**:
   - Minimum 6 characters
   - Recommended: Mix of upper, lower, numbers, symbols
   - Watch strength indicator (Faible → Moyen → Fort)
4. **Confirm Password** - Re-enter password exactly
5. **Submit** - Click "Activer mon compte"
6. **Success** - See confirmation screen
7. **Login** - Click link to go to login page

### After Activation

- **Email:** Your email address
- **Password:** The password you just created
- **Go To:** Login page at `/login`

---

## Field Definitions

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Prénom | Text | ✅ Yes | Doctor's first name |
| Nom | Text | ✅ Yes | Doctor's last name |
| Email | Email | ✅ Yes | Must be unique, used for login |
| N° d'Identité | Text | ✅ Yes | National ID, passport, or license # |
| Téléphone | Phone | ❌ No | Professional phone number |
| Adresse | Text | ❌ No | Professional address |
| Spécialité | Text | ❌ No | Defaults to "Ophtalmologie" |
| Rôle | Select | ✅ Fixed | Always "Médecin" |

---

## Status Badges Explained

| Status | Color | Meaning | Action |
|--------|-------|---------|--------|
| ✏️ En attente d'activation | Yellow | Account created, waiting for doctor to set password | Send reminder email |
| ✅ Actif | Green | Account activated, doctor can log in | Normal operation |
| ❌ Inactif | Red | Account deactivated | Reactivate if needed |

---

## Common Tasks

### How to Edit a Doctor's Info
1. Go to Médecins section
2. Find doctor in list
3. Click ✏️ (edit button)
4. Update fields (except email on some systems)
5. Click "Enregistrer"

### How to Delete a Doctor Account
1. Go to Médecins section
2. Find doctor in list
3. Click 🗑️ (delete button)
4. Confirm deletion
5. Account removed

### Doctor Hasn't Activated Yet (After 24 Hours)
1. Activation link expired
2. Create new account with same email
3. Doctor receives new activation email
4. Old account can be deleted

### Doctor Forgot Password
1. They cannot reset it themselves (activation only)
2. **Option 1:** Delete account and create new one
3. **Option 2:** Manual password reset (admin only)

---

## Email Configuration

### SMTP Settings (in .env)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME=DR Screening
```

### Gmail App Password Setup
1. Go to myaccount.google.com/security
2. Enable 2-Step Verification (if not enabled)
3. Go to myaccount.google.com/apppasswords
4. Select Mail and Device
5. Get 16-character password
6. Use as SMTP_PASS (without spaces)

---

## Troubleshooting Quick Fixes

### ❌ "Email is already in use"
- Email already exists in system
- Use different email or delete old account first

### ❌ "Identity is required"
- All required fields must be filled
- Fill in ID number field

### ❌ Doctor didn't receive email
- Check spam/junk folder
- Verify SMTP configuration
- Check internet connection
- Resend by creating new account

### ❌ "Password doesn't match"
- Type passwords exactly the same
- Check Caps Lock
- Copy-paste can work too

### ❌ "Password too short"
- Minimum 6 characters required
- Add more characters

### ❌ Can't log in after activation
- Verify email address (case matters)
- Verify password is correct
- Check Caps Lock
- Browser cache: Clear and retry

---

## Security Best Practices

✅ **DO:**
- Use strong passwords (upper, lower, numbers, symbols)
- Change passwords regularly
- Keep email addresses current
- Check activation emails in spam folder
- Activate within 24 hours

❌ **DON'T:**
- Share activation links
- Use dictionary words as passwords
- Share passwords via email
- Give access to others' accounts
- Ignore expiration notices

---

## Account Activation Flow (Visual)

```
┌─────────────────────────────────────────┐
│ Admin Creates Doctor Account            │
│ (Fills: Name, Email, ID, Phone, etc)    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ System Generates JWT Token (24hr valid) │
│ Account Status: PENDING                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Activation Email Sent                   │
│ Contains: Activation Link + Instructions│
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Doctor Clicks Activation Link           │
│ or manually enters URL                  │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Doctor Sets Password                    │
│ Enters password twice for confirmation  │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ System Validates & Activates            │
│ Account Status: ACTIVE                  │
│ Password hashed and stored              │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Doctor Logs In                          │
│ Email + Password → Dashboard            │
└─────────────────────────────────────────┘
```

---

## Links & References

- **Admin Panel:** `/center/doctors`
- **Activation Page:** `/activate/{token}` (sent via email)
- **Login Page:** `/login`
- **Password Requirements:** Minimum 6 characters
- **Token Expiration:** 24 hours
- **Documentation:** See `DOCTOR_ACCOUNT_CREATION_WORKFLOW.md`

---

**Created:** May 4, 2026  
**Last Updated:** May 4, 2026  
**Version:** 1.0
