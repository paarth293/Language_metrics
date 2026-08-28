import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token if available
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("lm_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
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
  listTeachers: (status?: "pending" | "approved" | "rejected") =>
    api.get("/admin/teachers", { params: status ? { status } : undefined }),

  setTeacherStatus: (
    teacherId: string,
    status: "pending" | "approved" | "rejected"
  ) => api.patch(`/admin/teachers/${teacherId}`, { status }),
};

export default api;
