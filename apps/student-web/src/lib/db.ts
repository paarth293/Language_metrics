import { db } from "@repo/database";

export const prisma = db; // Export both for backward compatibility if needed
export { db };
export default db;
