# FlutterFlow Setup Guide

I cannot create a FlutterFlow account on your behalf. Use this guide to set up a shared team project that mirrors the AuthPage spec.

## 1. Create FlutterFlow Account

1. Go to [https://app.flutterflow.io/](https://app.flutterflow.io/)
2. Sign up with Google or email
3. Create a new project: **MultiSport USA**

## 2. Connect Supabase

1. In FlutterFlow: **Settings & Integrations** → **Integrations** → **Supabase**
2. Enter your Supabase URL and Anon Key (from `docs/SUPABASE_SETUP.md`)
3. Click **Enable Supabase**
4. Import tables: `profiles`, `sports`, `venues`, `games`, `bookings`

## 3. Multi-User Team Access

1. Go to **Settings** → **Collaboration**
2. Click **Invite Collaborator**
3. Add team members by email
4. Assign roles:
   - **Admin** — full project access
   - **Editor** — can edit UI and logic
   - **Viewer** — read-only preview

All collaborators work on the same project in real time.

## 4. Build AuthPage Components (Per Spec Sheet)

Create page: **AuthPage** with two tabs — Sign In and Register.

### Sign In Form

| Variable Name | Component | Validation |
|---|---|---|
| `email_SignIn` | TextField (Email) | Regex: `[^@]+@[^@]+\.[^@]+` |
| `password_SignIn` | TextField (Password, obscured) | Non-empty |
| `btn_ForgotPassword` | Text Link (blue) | Navigates to Forgot Password page |
| `LetsPlay_Submit` | Button (solid) | Validates form → Supabase `signInWithEmail` |
| `error_SignIn_Message` | Text (hidden by default) | Show on auth failure |

### Register Form

| Variable Name | Component | Validation |
|---|---|---|
| `firstName_Register` | TextField | Alphabetic only, 1–60 chars |
| `lastName_Register` | TextField | Alphabetic only, 1–60 chars |
| `email_Register` | TextField (Email) | Email format + API call to check duplicate |
| `password_Register` | TextField (Password) | Min 10 chars, 1 upper, 1 lower, 1 number, 1 special |
| `confirmPassword_Register` | TextField (Password) | Must match `password_Register` |
| `CreateAccount_Submit` | Button (solid) | All validations pass → Supabase `signUp` |

### FlutterFlow Action Flow for Register

1. **On Page Load** — set `error_SignIn_Message` visibility = false
2. **On CreateAccount_Submit tap:**
   - Run custom validation on all fields
   - If invalid → show error, stop
   - Call API: `GET /api/auth/check-email?email={email_Register}`
   - If exists → show "Email already registered"
   - Call Supabase Auth: `signUp(email, password, { first_name, last_name })`
   - On success → navigate to Home

### FlutterFlow Action Flow for Sign In

1. **On LetsPlay_Submit tap:**
   - Validate `email_SignIn` and `password_SignIn`
   - Call Supabase Auth: `signInWithEmail`
   - On failure → set `error_SignIn_Message` visible with error text
   - On success → navigate to Home

## 5. Custom Functions (FlutterFlow)

Create these in **Custom Code** → **Functions**:

```dart
bool isValidEmail(String email) {
  final regex = RegExp(r'[^@]+@[^@]+\.[^@]+');
  return regex.hasMatch(email);
}

bool isValidName(String name) {
  final regex = RegExp(r'^[A-Za-z]{1,60}$');
  return regex.hasMatch(name);
}

bool isValidPassword(String password) {
  if (password.length < 10) return false;
  if (!password.contains(RegExp(r'[A-Z]'))) return false;
  if (!password.contains(RegExp(r'[a-z]'))) return false;
  if (!password.contains(RegExp(r'[0-9]'))) return false;
  if (!password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) return false;
  return true;
}
```

## 6. Sync with Angular Web App

Both FlutterFlow (mobile) and Angular (web) share the same Supabase backend. Use identical field variable names from the spec sheet for consistency across platforms.
