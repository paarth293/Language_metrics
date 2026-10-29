import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockRequireAdmin, mockHeaders, mockAuditLog } = vi.hoisted(() => ({
  mockDb: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    adminUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  mockRequireAdmin: vi.fn(),
  mockHeaders: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  db: mockDb,
}));

vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

vi.mock("@/lib/guards", () => ({
  requireAdmin: mockRequireAdmin,
}));

vi.mock("@/lib/audit", () => ({
  auditLog: mockAuditLog,
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("mocked_hashed_pw"),
}));

import { inviteAdminAction } from "./actions";

describe("inviteAdminAction - Duplicate Email & Concurrency", () => {
  const superAdmin = {
    id: "admin-1",
    email: "superadmin@example.com",
    roleKey: "SUPER_ADMIN",
    isSuperAdmin: true,
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(superAdmin);
    mockHeaders.mockResolvedValue(new Map([["x-forwarded-for", "127.0.0.1"]]));
  });

  function createFormData(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(data)) {
      fd.append(k, v);
    }
    return fd;
  }

  it("1. successfully creates an admin user when email is new", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.adminUser.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({ id: "user-new", email: "newadmin@example.com" });
    mockDb.adminUser.create.mockResolvedValue({ userId: "user-new", email: "newadmin@example.com" });

    const formData = createFormData({
      name: "New Admin",
      email: "newadmin@example.com",
      roleKey: "SUPPORT_ADMIN",
    });

    const result = await inviteAdminAction(null, formData);

    expect(result.success).toBe(true);
    expect(result.createdEmail).toBe("newadmin@example.com");
    expect(result.temporaryPassword).toBeDefined();
    expect(mockDb.user.create).toHaveBeenCalledTimes(1);
    expect(mockDb.adminUser.create).toHaveBeenCalledTimes(1);
  });

  it("2. returns EMAIL_ALREADY_EXISTS and friendly message when email exists in db.user", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-existing", email: "existing@example.com" });
    mockDb.adminUser.findUnique.mockResolvedValue(null);

    const formData = createFormData({
      name: "Existing User",
      email: "existing@example.com",
      roleKey: "SUPPORT_ADMIN",
    });

    const result = await inviteAdminAction(null, formData);

    expect(result.error).toBe(
      "This email address is already registered. Please use another email address or sign in to your existing account."
    );
    expect(result.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(mockDb.user.create).not.toHaveBeenCalled();
    expect(mockDb.adminUser.create).not.toHaveBeenCalled();
  });

  it("3. returns EMAIL_ALREADY_EXISTS when email exists in db.adminUser", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.adminUser.findUnique.mockResolvedValue({ userId: "admin-existing", email: "admin@example.com" });

    const formData = createFormData({
      name: "Existing Admin",
      email: "admin@example.com",
      roleKey: "CONTENT_ADMIN",
    });

    const result = await inviteAdminAction(null, formData);

    expect(result.error).toBe(
      "This email address is already registered. Please use another email address or sign in to your existing account."
    );
    expect(result.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });

  it("4. normalizes email case and whitespace before checking uniqueness", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "user-existing", email: "existing@example.com" });
    mockDb.adminUser.findUnique.mockResolvedValue(null);

    const formData = createFormData({
      name: "Case Test",
      email: "   EXISTING@EXAMPLE.COM   ",
      roleKey: "SUPPORT_ADMIN",
    });

    const result = await inviteAdminAction(null, formData);

    expect(result.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { email: "existing@example.com" },
    });
    expect(mockDb.adminUser.findUnique).toHaveBeenCalledWith({
      where: { email: "existing@example.com" },
    });
  });

  it("5. catches simultaneous registration P2002 constraint error safely without throwing", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.adminUser.findUnique.mockResolvedValue(null);

    // Simulate concurrent creation throwing P2002
    const p2002Error = new Error("Unique constraint failed on the fields: (`email`)");
    (p2002Error as unknown as { code: string }).code = "P2002";
    mockDb.user.create.mockRejectedValue(p2002Error);

    const formData = createFormData({
      name: "Concurrent Admin",
      email: "race@example.com",
      roleKey: "SUPPORT_ADMIN",
    });

    const result = await inviteAdminAction(null, formData);

    expect(result.error).toBe(
      "This email address is already registered. Please use another email address or sign in to your existing account."
    );
    expect(result.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});
