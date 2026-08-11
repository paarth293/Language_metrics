/**
 * Lightweight request-body validators.
 * Each returns an error message string if validation fails, or null if OK.
 */

const isValidEmail = (email: unknown): boolean =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());

export interface RegisterStudentInput {
  name?: string;
  email?: string;
  password?: string;
  languageToLearn?: string;
  proficiencyLevel?: string;
}

export interface RegisterTeacherInput {
  name?: string;
  email?: string;
  password?: string;
  experienceType?: string;
}

export interface LoginInput {
  email?: string;
  password?: string;
}

export function validateRegisterStudent({
  name,
  email,
  password,
  languageToLearn,
}: RegisterStudentInput): string | null {
  if (!name || !email || !password || !languageToLearn) {
    return "name, email, password, and languageToLearn are required.";
  }
  if (!isValidEmail(email)) return "Invalid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export function validateRegisterTeacher({
  name,
  email,
  password,
  experienceType,
}: RegisterTeacherInput): string | null {
  if (!name || !email || !password || !experienceType) {
    return "name, email, password, and experienceType are required.";
  }
  if (!isValidEmail(email)) return "Invalid email address.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export function validateLogin({ email, password }: LoginInput): string | null {
  if (!email || !password) return "email and password are required.";
  if (!isValidEmail(email)) return "Invalid email address.";
  return null;
}
