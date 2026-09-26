-- Date of birth for students and teachers. Nullable on purpose: the 19 accounts
-- created before DOB collection have none, and are asked for it on next login.
-- New signups must provide it (enforced in the API: students 5+, teachers 18+).

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "dateOfBirth" DATE;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "dateOfBirth" DATE;
