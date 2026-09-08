import { z } from "zod";

export const TeacherSearchQuerySchema = z.object({
  language: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().positive().optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TeacherSearchQuery = z.infer<typeof TeacherSearchQuerySchema>;

export const TeacherCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  languages: z.array(z.string()),
  hourlyRate: z.number().int().positive(),
  rating: z.number().min(0).max(5),
  totalReviews: z.number().int().min(0),
  totalLessons: z.number().int().min(0),
  isVerified: z.boolean().default(true),
});
export type TeacherCard = z.infer<typeof TeacherCardSchema>;

export const TeacherDetailSchema = TeacherCardSchema.extend({
  bio: z.string(),
  experienceYears: z.number().int().min(0),
  availableSlots: z.array(
    z.object({
      id: z.string(),
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      isBooked: z.boolean(),
    })
  ).optional(),
});
export type TeacherDetail = z.infer<typeof TeacherDetailSchema>;

export const TeacherSearchResponseSchema = z.object({
  teachers: z.array(TeacherCardSchema),
  pagination: z.object({
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(0),
  }),
});
export type TeacherSearchResponse = z.infer<typeof TeacherSearchResponseSchema>;
