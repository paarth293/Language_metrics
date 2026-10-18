-- Teacher availability is entered as local wall-clock time; store the zone it
-- was entered in so bookings can be validated against it. Nullable: existing
-- teachers fall back to the platform default until they next save their hours.

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "timeZone" TEXT;

-- Anchor for the reschedule window, set on the first reschedule.

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "originalStart" TIMESTAMP(3);
