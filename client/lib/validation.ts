const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernameRe = /^[a-z0-9_]{3,20}$/;

export type FieldErrors = Record<string, string>;

export function validateLogin(v: { email: string; password: string }): FieldErrors {
  const e: FieldErrors = {};
  if (!emailRe.test(v.email.trim())) e.email = "Enter a valid email address";
  if (!v.password) e.password = "Enter your password";
  return e;
}

export function validateSignup(v: {
  name: string;
  email: string;
  username: string;
  password: string;
}): FieldErrors {
  const e: FieldErrors = {};
  if (!v.name.trim()) e.name = "Enter your name";
  else if (v.name.trim().length > 60) e.name = "Name is too long (max 60)";
  if (!emailRe.test(v.email.trim())) e.email = "Enter a valid email address";
  if (!usernameRe.test(v.username)) e.username = "3-20 chars: lowercase letters, numbers, underscore";
  if (v.password.length < 8) e.password = "Use at least 8 characters";
  else if (v.password.length > 128) e.password = "Password is too long (max 128)";
  return e;
}
