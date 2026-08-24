import { z } from "zod";

/** Teacher approval/rejection — PATCH /api/teachers/[id] */
export const teacherStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    message: "Status must be 'APPROVED' or 'REJECTED'.",
  }),
});

/** Teacher moderation actions — POST /api/teachers/[id]/status */
export const teacherActionSchema = z.object({
  action: z.enum(["suspend", "reactivate", "ban"], {
    message: "Action must be 'suspend', 'reactivate', or 'ban'.",
  }),
});

/** Payout status update — PATCH /api/payouts/[id] */
export const payoutStatusSchema = z.object({
  status: z.enum(["PAID", "FAILED"], {
    message: "Status must be 'PAID' or 'FAILED'.",
  }),
  transactionRef: z.string().max(200).optional().nullable(),
});

/** Password change */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character."),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

/**
 * Helper: parse request body against a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? "Invalid input.";
    return { success: false, error: firstError };
  }
  return { success: true, data: result.data };
}
