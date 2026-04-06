import { describe, expect, it, vi } from "vitest";

const { getAuthUserMock } = vi.hoisted(() => ({
  getAuthUserMock: vi.fn(),
}));

vi.mock("../../src/repositories/userRepo.js", () => ({
  getAuthUser: getAuthUserMock,
  SourceType: {},
}));

import { authMiddleware } from "../../src/middleware/auth.ts";

describe("authMiddleware", () => {
  it("returns 401 when bearer token is missing", async () => {
    const req: any = { method: "GET", path: "/api/leads", headers: {} };
    const status = vi.fn(() => ({ json: vi.fn() }));
    const res: any = { status };
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches user and calls next for valid token", async () => {
    getAuthUserMock.mockResolvedValue({
      id: "user-1",
      email: "owner@inmo24x7.com",
      tenant_id: "tenant-1",
      role: "owner",
      is_admin: false,
    });

    const req: any = {
      method: "GET",
      path: "/api/leads",
      headers: { authorization: "Bearer valid-token", "x-source-type": "backoffice" },
    };
    const res: any = { status: vi.fn(() => ({ json: vi.fn() })) };
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(getAuthUserMock).toHaveBeenCalledWith("valid-token");
    expect(req.user).toMatchObject({
      id: "user-1",
      tenant_id: "tenant-1",
      source_type: "backoffice",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
