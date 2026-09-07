import axios from "axios";
import type { VerificationStatus } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

// Auth is entirely cookie-based (see lib/auth-client.tsx) — the browser
// attaches the httpOnly lm_access_token cookie automatically, so this client
// never needs to (and never should) read a token from localStorage or set an
// Authorization header. `withCredentials` makes sure the cookie is sent even
// if API_BASE ever points at a different origin.
const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Auth API calls
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  registerStudent: (data: {
    name: string;
    email: string;
    password: string;
    languageToLearn: string;
    proficiencyLevel?: string;
  }) => api.post("/auth/register/student", data),

  registerTeacher: (data: {
    name: string;
    email: string;
    password: string;
    language: string;
    languages: string[];
    gender?: string;
    qualificationDocUrl: string;
    idProofDocUrl: string;
    experienceType: string;
    experienceDocUrl?: string;
    experienceDescription?: string;
  }) => api.post("/auth/register/teacher", data),
};

// Student API calls
export const studentApi = {
  getProfile: () => api.get("/students/me"),
};

// Teacher API calls
export const teacherApi = {
  getProfile: () => api.get("/teachers/me"),
};

// Admin API calls
export const adminApi = {
  getProfile: () => api.get("/admins/me"),

  // Teacher verification queue
  listTeachers: (status?: VerificationStatus) =>
    api.get("/admin/teachers", { params: status ? { status } : undefined }),

  setTeacherStatus: (
    teacherId: string,
    status: Extract<VerificationStatus, "APPROVED" | "REJECTED">
  ) => api.patch(`/admin/teachers/${teacherId}`, { status }),
};

export default api;
