import { describe, expect, it } from "vitest";
import { chatSendError } from "./chat-send-error";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("chatSendError", () => {
  it("uses the server's reason when it sends one", async () => {
    expect(await chatSendError(json(403, { error: "You don't have a conversation with this teacher." })))
      .toBe("Message not sent. You don't have a conversation with this teacher.");
    expect(await chatSendError(json(429, { error: "Too many messages. Please slow down." })))
      .toBe("Message not sent. Too many messages. Please slow down.");
  });

  it("falls back to a reason per status", async () => {
    expect(await chatSendError(json(400, {}))).toContain("could not be sent as written");
    expect(await chatSendError(json(403, {}))).toContain("booking with");
    expect(await chatSendError(json(413, {}))).toContain("too large");
    expect(await chatSendError(json(429, {}))).toContain("too quickly");
  });

  it("falls back for an unexpected status or a non-JSON body", async () => {
    expect(await chatSendError(json(500, {}))).toBe("Message not sent. Please check your connection and try again.");
    expect(await chatSendError(new Response("<html>502</html>", { status: 502 })))
      .toBe("Message not sent. Please check your connection and try again.");
  });

  it("ignores a blank or non-string error field", async () => {
    expect(await chatSendError(json(413, { error: "   " }))).toContain("too large");
    expect(await chatSendError(json(413, { error: 42 }))).toContain("too large");
  });

  it("always names the outcome first, so the notice reads the same everywhere", async () => {
    for (const status of [400, 403, 413, 429, 500]) {
      expect(await chatSendError(json(status, {}))).toMatch(/^Message not sent\. /);
    }
  });
});
