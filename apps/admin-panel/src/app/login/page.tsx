import { cookies, headers } from "next/headers";
import { CSRF_COOKIE } from "@/lib/csrf";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const store = await cookies();
  const h = await headers();
  const csrfToken = store.get(CSRF_COOKIE)?.value ?? h.get("x-csrf-token") ?? "";
  
  return <LoginForm csrfToken={csrfToken} />;
}
