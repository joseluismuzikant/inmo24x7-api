import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listTenantPlansMock,
  listTenantsMock,
  onboardTenantMock,
  createTenantChannelMock,
  listTenantChannelsMock,
  updateChannelMock,
  updateTenantStatusMock,
  deleteTenantMock,
  requireTenantIdMock,
} = vi.hoisted(() => ({
  listTenantPlansMock: vi.fn(),
  listTenantsMock: vi.fn(),
  onboardTenantMock: vi.fn(),
  createTenantChannelMock: vi.fn(),
  listTenantChannelsMock: vi.fn(),
  updateChannelMock: vi.fn(),
  updateTenantStatusMock: vi.fn(),
  deleteTenantMock: vi.fn(),
  requireTenantIdMock: vi.fn(),
}));

vi.mock("../../src/services/adminTenants.js", () => ({
  listTenantPlans: listTenantPlansMock,
  listTenants: listTenantsMock,
  onboardTenant: onboardTenantMock,
  createTenantChannel: createTenantChannelMock,
  listTenantChannels: listTenantChannelsMock,
  updateChannel: updateChannelMock,
  updateTenantStatus: updateTenantStatusMock,
  deleteTenant: deleteTenantMock,
}));

vi.mock("../../src/services/userService.js", () => ({
  requireTenantId: requireTenantIdMock,
}));

import { adminRouter } from "../../src/routes/admin.ts";

function buildApp(user?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use(adminRouter);
  return app;
}

describe("admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listTenantPlansMock.mockResolvedValue([]);
    listTenantsMock.mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 1 });
  });

  it("forbids tenant plans for non-admin users", async () => {
    const app = buildApp({ is_admin: false });

    const res = await request(app).get("/admin/tenant-plans");

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Forbidden");
  });

  it("lists tenant plans for admin users", async () => {
    const app = buildApp({ id: "admin-1", is_admin: true });
    listTenantPlansMock.mockResolvedValue([{ tenant_id: "tenant-1", plan_code: "free" }]);

    const res = await request(app).get("/admin/tenant-plans");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ tenant_id: "tenant-1", plan_code: "free" }]);
    expect(listTenantPlansMock).toHaveBeenCalledTimes(1);
  });
});
