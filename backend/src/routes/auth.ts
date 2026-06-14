import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";
import {
  validateSignIn,
  validateRegister,
  SignInBody,
  RegisterBody,
} from "../lib/validators";

const router = Router();
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;

/* ── In-memory OTP store (dev-only; swap to Redis / DB for production) ── */
interface OtpEntry {
  code: string;
  expiresAt: number;
}
const otpStore = new Map<string, OtpEntry>();

function otpKey(type: string, target: string): string {
  return `${type}:${target.trim().toLowerCase()}`;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* POST /api/auth/send-otp */
router.post("/send-otp", (req: Request, res: Response) => {
  const { type, target } = req.body as { type?: string; target?: string };

  if (!type || !["email", "phone"].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be 'email' or 'phone'." });
  }
  if (!target?.trim()) {
    return res.status(400).json({ success: false, message: `${type} value is required.` });
  }

  const code = generateOtp();
  const key = otpKey(type, target);
  otpStore.set(key, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

  // Log to console so the developer can grab the code easily
  console.log(`\n🔑  OTP for ${type} "${target}": ${code}\n`);

  return res.json({ success: true, message: `Verification code sent to your ${type}.` });
});

/* POST /api/auth/verify-otp */
router.post("/verify-otp", (req: Request, res: Response) => {
  const { type, target, code } = req.body as {
    type?: string;
    target?: string;
    code?: string;
  };

  if (!type || !["email", "phone"].includes(type)) {
    return res.status(400).json({ verified: false, message: "type must be 'email' or 'phone'." });
  }
  if (!target?.trim() || !code?.trim()) {
    return res.status(400).json({ verified: false, message: "target and code are required." });
  }

  const key = otpKey(type, target);
  const entry = otpStore.get(key);

  if (!entry) {
    return res.status(400).json({ verified: false, message: "No verification code found. Please request a new one." });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({ verified: false, message: "Verification code has expired. Please request a new one." });
  }

  if (entry.code !== code.trim()) {
    return res.status(400).json({ verified: false, message: "Incorrect verification code." });
  }

  otpStore.delete(key);
  return res.json({ verified: true, message: `${type === "email" ? "Email" : "Phone number"} verified successfully.` });
});

router.get("/check-email", async (req: Request, res: Response) => {
  const email = req.query.email as string;

  if (!email || !/[^@]+@[^@]+\.[^@]+/.test(email)) {
    return res.status(400).json({ exists: false, message: "Invalid email format." });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("Supabase error in check-email:", error);
    return res.status(500).json({ exists: false, message: error.message || "Database query failed." });
  }

  return res.json({ exists: !!data, email });
});

router.get("/check-username", async (req: Request, res: Response) => {
  const username = (req.query.username as string)?.trim().toLowerCase();

  if (!username || !USERNAME_REGEX.test(username)) {
    return res.status(400).json({ exists: false, message: "Invalid username format." });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("Supabase error in check-username:", error);
    return res.status(500).json({ exists: false, message: error.message || "Database query failed." });
  }

  return res.json({ exists: !!data, username });
});

router.post("/signin", async (req: Request, res: Response) => {
  const body = req.body as SignInBody;
  const validationError = validateSignIn(body);

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const usernameOrEmail = body.username_SignIn.trim();
  let email = usernameOrEmail;

  if (!usernameOrEmail.includes("@")) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username", usernameOrEmail.toLowerCase())
      .maybeSingle();

    if (error || !profile?.email) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    email = profile.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password: body.password_SignIn,
  });

  if (error) {
    return res.status(401).json({ success: false, message: "Invalid username or password." });
  }

  return res.json({
    success: true,
    user: data.user,
    session: data.session,
  });
});

router.post("/register", async (req: Request, res: Response) => {
  const body = req.body as RegisterBody;
  const validationError = validateRegister(body);

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const username = body.username_Register.trim().toLowerCase();
  const email = body.email_Register.trim().toLowerCase();

  const { data: existingUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingUsername) {
    return res.status(409).json({ success: false, message: "Username is already taken." });
  }

  const { data: existingEmail } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingEmail) {
    return res.status(409).json({ success: false, message: "An account with this email already exists." });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: body.password_Register,
    user_metadata: {
      username,
      handedness: body.handedness_Register,
      gender: body.gender_Register,
      rating: body.rating_Register ?? 3,
    },
  });

  if (error) {
    const message = error.message.includes("already registered")
      ? "An account with this email already exists."
      : error.message;
    return res.status(400).json({ success: false, message });
  }

  const userId = data.user?.id;
  if (userId) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      first_name: body.username_Register,
      last_name: '',
      email,
      username,
      handedness: body.handedness_Register,
      gender: body.gender_Register,
      rating: body.rating_Register ?? 3,
      is_active: true,
    });

    if (profileError) {
      console.error("Failed to ensure profile row exists:", profileError);
      return res.status(500).json({
        success: false,
        message: "Profile creation failed.",
        error: profileError,
      });
    }
  }

  return res.status(201).json({
    success: true,
    user: data.user ?? data,
    message: "Account created successfully.",
  });
});

router.get("/debug/profiles", async (_req: Request, res: Response) => {
  const { data, error } = await supabase.from("profiles").select("*").limit(100);

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || !/[^@]+@[^@]+\.[^@]+/.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format." });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.CORS_ORIGIN ?? "http://localhost:4200"}/auth/reset-password`,
  });

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({
    success: true,
    message: "Password reset email sent if the account exists.",
  });
});

export default router;
