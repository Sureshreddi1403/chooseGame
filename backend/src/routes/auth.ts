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
    phone: body.phoneNumber_Register,
    user_metadata: {
      username,
      handedness: body.handedness_Register,
      gender: body.gender_Register,
      rating: body.rating_Register ?? 3,
      email_verified: body.emailVerified_Register,
      phone_verified: body.phoneVerified_Register,
    },
    email_confirm: body.emailVerified_Register,
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
      phone_number: body.phoneNumber_Register,
      handedness: body.handedness_Register,
      gender: body.gender_Register,
      rating: body.rating_Register ?? 3,
      email_verified: body.emailVerified_Register,
      phone_verified: body.phoneVerified_Register,
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
