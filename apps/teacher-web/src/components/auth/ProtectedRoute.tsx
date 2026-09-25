"use client";

import React from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return <>{children}</>;
}

