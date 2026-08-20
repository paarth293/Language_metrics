"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(prevState: any, formData: FormData) {
  const username = formData.get("username");
  const password = formData.get("password");

  if (username === "admin" && password === "12345678") {
    // Set a secure HTTP-only cookie to track authentication
    (await cookies()).set("admin_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    redirect("/");
  }

  return { error: "Invalid username or password" };
}

export async function logoutAction() {
  (await cookies()).delete("admin_session");
  redirect("/login");
}
