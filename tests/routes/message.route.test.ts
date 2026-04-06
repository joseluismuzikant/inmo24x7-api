import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { botReplyMock } = vi.hoisted(() => ({
  botReplyMock: vi.fn(),
}));

vi.mock("../../src/services/botService.js", () => ({
  botReply: botReplyMock,
}));

import { messageRouter } from "../../src/routes/message.ts";

function buildApp(user?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use(messageRouter);
  return app;
}

describe("message routes", () => {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    botReplyMock.mockResolvedValue({ messages: ["hola"] });
  });

  it("returns 400 on invalid payload", async () => {
    const app = buildApp({ tenant_id: tenantId, source_type: "web_chat" });

    const res = await request(app).post("/message").send({ userId: "", text: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid payload");
  });

  it("returns 401 when tenant id is missing", async () => {
    const app = buildApp({ source_type: "web_chat" });

    const res = await request(app).post("/message").send({ userId: "u1", text: "Hola", tenantId });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Unauthorized");
  });

  it("returns 403 when tenant user sends different tenant id", async () => {
    const app = buildApp({ tenant_id: tenantId, source_type: "web_chat", is_admin: false });

    const res = await request(app)
      .post("/message")
      .send({ userId: "u1", text: "Hola", tenantId: "22222222-2222-2222-2222-222222222222" });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("tenant mismatch");
  });

  it("returns bot response on success", async () => {
    const app = buildApp({ tenant_id: tenantId, source_type: "web_chat" });
    botReplyMock.mockResolvedValue({ messages: ["Respuesta del bot"] });

    const res = await request(app).post("/message").send({ userId: "u1", text: "Hola", tenantId });

    expect(res.status).toBe(200);
    expect(botReplyMock).toHaveBeenCalledWith({
      userId: "u1",
      text: "Hola",
      tenantId,
      sourceType: "web_chat",
    });
    expect(res.body).toEqual({ messages: ["Respuesta del bot"] });
  });
});
