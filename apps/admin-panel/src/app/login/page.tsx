import { cookies } from "next/headers";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("csrf_token")?.value || "";

  return <LoginForm csrfToken={token} error={params.error} />;
}
