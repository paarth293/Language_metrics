import "@testing-library/jest-dom";
import { vi } from "vitest";

// Globally mock Prisma database client
vi.mock("@repo/database", () => {
  return {
    db: {
      adminUser: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    },
  };
});
