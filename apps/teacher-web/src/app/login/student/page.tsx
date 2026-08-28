"use client";

import { useEffect } from "react";

/**
 * Student login is handled exclusively by student-web (localhost:3002).
 * Redirect there immediately so the auth cookie is set on the correct origin.
 */
export default function StudentLoginPage() {
  useEffect(() => {
    window.location.replace("http://localhost:3002/login");
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
      <p>Redirecting to student login…</p>
    </div>
  );
}
