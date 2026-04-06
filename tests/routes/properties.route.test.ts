import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAllPropertiesMock, getPropertiesPageMock, importPropertiesFromJsonForTenantMock, deletePropertyByIdMock } = vi.hoisted(() => ({
  getAllPropertiesMock: vi.fn(),
  getPropertiesPageMock: vi.fn(),
  importPropertiesFromJsonForTenantMock: vi.fn(),
  deletePropertyByIdMock: vi.fn(),
}));

vi.mock("../../src/repositories/propertyRepo.js", () => ({
  getAllProperties: getAllPropertiesMock,
  getPropertiesPage: getPropertiesPageMock,
  deletePropertyById: deletePropertyByIdMock,
}));

vi.mock("../../src/services/propertyService.js", () => ({
  importPropertiesFromJsonForTenant: importPropertiesFromJsonForTenantMock,
}));

import { propertiesRouter } from "../../src/routes/properties.ts";

function buildApp(user?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use(propertiesRouter);
  return app;
}

describe("properties routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports properties for authenticated tenant", async () => {
    const app = buildApp({ tenant_id: "tenant-1", is_admin: false });
    importPropertiesFromJsonForTenantMock.mockResolvedValue({
      total: 2,
      inserted: 1,
      updated: 0,
      failed: 1,
      errors: [{ index: 1, id: "prop-2", message: "bad data" }],
    });

    const res = await request(app)
      .post("/api/properties/import-json")
      .send({ properties: [{ id: "prop-1" }, { id: "prop-2" }] });

    expect(res.status).toBe(200);
    expect(importPropertiesFromJsonForTenantMock).toHaveBeenCalledWith("tenant-1", {
      properties: [{ id: "prop-1" }, { id: "prop-2" }],
    });
    expect(res.body.total).toBe(2);
    expect(res.body.failed).toBe(1);
  });

  it("returns 400 when admin import has no tenant_id", async () => {
    const app = buildApp({ is_admin: true, tenant_id: null });

    const res = await request(app).post("/api/properties/import-json").send({ properties: [] });

    expect(res.status).toBe(400);
  });

  it("allows admin import when tenant_id is provided in payload", async () => {
    const app = buildApp({ is_admin: true, tenant_id: null });
    importPropertiesFromJsonForTenantMock.mockResolvedValue({
      total: 1,
      inserted: 1,
      updated: 0,
      failed: 0,
      errors: [],
    });

    const res = await request(app)
      .post("/api/properties/import-json")
      .send({ tenant_id: "tenant-abc", properties: [{ id: "prop-1" }] });

    expect(res.status).toBe(200);
    expect(importPropertiesFromJsonForTenantMock).toHaveBeenCalledWith("tenant-abc", {
      properties: [{ id: "prop-1" }],
    });
  });

  it("deletes a property for tenant user", async () => {
    const app = buildApp({ tenant_id: "tenant-1", is_admin: false });
    deletePropertyByIdMock.mockResolvedValue({ deleted: true, id: "prop-1" });

    const res = await request(app).delete("/api/properties/prop-1");

    expect(res.status).toBe(200);
    expect(deletePropertyByIdMock).toHaveBeenCalledWith("prop-1", { tenantId: "tenant-1", isAdmin: false });
    expect(res.body).toEqual({ deleted: true, id: "prop-1" });
  });
});
