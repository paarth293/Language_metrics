import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/tokens";

export default async function StudentWebRoot() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload?.sub && payload?.role === "STUDENT") {
      redirect("/dashboard");
    }
  }
  redirect("/login");
}
