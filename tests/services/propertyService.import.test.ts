import { describe, expect, it, vi } from "vitest";

const { upsertPropertyForTenantMock } = vi.hoisted(() => ({
  upsertPropertyForTenantMock: vi.fn(),
}));

vi.mock("../../src/repositories/propertyRepo.js", () => ({
  searchPropertiesInSupabase: vi.fn(),
  upsertPropertyForTenant: upsertPropertyForTenantMock,
}));

vi.mock("../../src/services/propertyLoader.js", () => ({
  loadPropertiesFromCSV: vi.fn(),
  loadPropertiesFromJson: vi.fn(),
}));

import { importPropertiesFromJsonForTenant } from "../../src/services/propertyService.ts";

describe("propertyService import", () => {
  it("throws for invalid payload", async () => {
    await expect(importPropertiesFromJsonForTenant("tenant-1", {})).rejects.toThrow(
      "Invalid payload: expected { properties: [] }",
    );
  });

  it("imports valid items and continues when one fails", async () => {
    upsertPropertyForTenantMock
      .mockResolvedValueOnce({ action: "inserted", id: "prop-1" })
      .mockRejectedValueOnce(new Error("db error"));

    const result = await importPropertiesFromJsonForTenant("tenant-1", {
      properties: [
        {
          id: "prop-1",
          url: "https://example.com/1",
          title: "Depto",
          operation_type: "venta",
          price_amount: 120000,
          price_currency: "USD",
          real_estate_type: "departamento",
          address_name: "Palermo",
        },
        {
          id: "prop-2",
          url: "https://example.com/2",
          title: "Casa",
          operation_type: "venta",
          price_amount: 90000,
          price_currency: "USD",
          real_estate_type: "casa",
          address_name: "Belgrano",
        },
      ],
    });

    expect(result.total).toBe(2);
    expect(result.inserted).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0].id).toBe("prop-2");
  });

  it("marks invalid items as failed without calling repository", async () => {
    const result = await importPropertiesFromJsonForTenant("tenant-1", {
      properties: [
        {
          id: "prop-1",
          title: "Sin URL",
        },
      ],
    });

    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain("url");
    expect(upsertPropertyForTenantMock).not.toHaveBeenCalled();
  });
});
