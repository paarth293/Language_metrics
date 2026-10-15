import { describe, expect, it } from "vitest";
import { deleteFile, getFileUrl, uploadFile } from "./storage";

describe("storage path boundaries", () => {
  it.each(["../outside", "/absolute", "teachers/../../outside", "teachers\\outside", "teachers/%2e%2e/outside"])("rejects unsafe upload folder %s before writing", async (folder) => {
    await expect(uploadFile(Buffer.from("test"), "file.txt", "text/plain", { folder, allowedTypes: ["text/plain"] })).rejects.toThrow("Invalid storage key");
  });

  it("rejects traversal in deletion and public URL lookup", async () => {
    await expect(deleteFile("../outside.txt")).rejects.toThrow("Invalid storage key");
    await expect(getFileUrl("../outside.txt")).rejects.toThrow("Invalid storage key");
  });
});
