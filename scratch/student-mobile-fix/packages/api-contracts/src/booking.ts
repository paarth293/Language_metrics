import { z } from "zod";

export const BookingStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const CreateBookingRequestSchema = z.object({
  teacherId: z.string().min(1),
  slotStart: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(180).default(60),
  notes: z.string().max(500).optional(),
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const BookingDetailSchema = z.object({
  id: z.string(),
  /** First ClassSession of the booking — used to request a LiveKit token. */
  sessionId: z.string().nullable().optional(),
  teacherId: z.string(),
  teacherName: z.string(),
  teacherAvatarUrl: z.string().nullable().optional(),
  studentId: z.string(),
  studentName: z.string(),
  slotStart: z.string().datetime(),
  slotEnd: z.string().datetime(),
  status: BookingStatusSchema,
  coinCost: z.number().int().min(0),
  meetingUrl: z.string().url().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type BookingDetail = z.infer<typeof BookingDetailSchema>;

export const BookingListResponseSchema = z.object({
  bookings: z.array(BookingDetailSchema),
  total: z.number().int().min(0),
});
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;
