const EMAIL_REGEX = /[^@]+@[^@]+\.[^@]+/;
const NAME_REGEX = /^[A-Za-z]{1,60}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{10,}$/;

export interface SignInBody {
  username_SignIn: string;
  password_SignIn: string;
}

export interface RegisterBody {
  username_Register: string;
  handedness_Register: 'left' | 'right';
  gender_Register: string;
  password_Register: string;
  confirmPassword_Register: string;
  phoneNumber_Register?: string;
  rating_Register?: number;
}

export function validateSignIn(body: SignInBody): string | null {
  if (!body.username_SignIn?.trim()) return "Username or email is required.";
  if (!body.password_SignIn) return "Password is required.";
  return null;
}

const GENDER_VALUES = [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
];

export function validateRegister(body: RegisterBody): string | null {
  if (!body.username_Register?.trim()) return "Username is required.";
  if (!USERNAME_REGEX.test(body.username_Register))
    return "Username must be 3–30 characters, letters, numbers, dots, or underscores.";

  if (!body.email_Register?.trim()) return "Email is required.";
  if (!EMAIL_REGEX.test(body.email_Register)) return "Invalid email format.";

  if (!body.handedness_Register) return "Handedness is required.";
  if (!['left', 'right'].includes(body.handedness_Register))
    return "Handedness must be left or right.";

  if (!body.gender_Register) return "Gender is required.";
  if (!GENDER_VALUES.includes(body.gender_Register))
    return "Gender value is invalid.";

  if (!body.password_Register) return "Password is required.";
  if (!PASSWORD_REGEX.test(body.password_Register))
    return "Password must be at least 10 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.";

  if (body.confirmPassword_Register !== body.password_Register)
    return "Passwords do not match.";

  return null;
}
