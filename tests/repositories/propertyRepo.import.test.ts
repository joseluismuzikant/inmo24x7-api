import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  selectMock,
  eqMock,
  maybeSingleMock,
  upsertMock,
  supabaseMock,
} = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq, maybeSingle }));
  const upsert = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "zp_postings") {
      return { select, upsert };
    }
    return { select, upsert };
  });

  return {
    fromMock: from,
    selectMock: select,
    eqMock: eq,
    maybeSingleMock: maybeSingle,
    upsertMock: upsert,
    supabaseMock: { from },
  };
});

vi.mock("../../src/lib/supabase.js", () => ({
  getSupabaseClient: () => supabaseMock,
}));

import { upsertPropertyForTenant } from "../../src/repositories/propertyRepo.ts";

describe("propertyRepo import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    upsertMock.mockResolvedValue({ error: null });
  });

  it("inserts property for tenant with normalized payload", async () => {
    const result = await upsertPropertyForTenant("tenant-1", {
      id: "prop-1",
      url: "https://example.com/1",
      title: "Depto",
      operation_type: "venta",
      price_amount: 100000,
      price_currency: "usd",
      real_estate_type: "departamento",
      address_name: "Palermo",
    });

    expect(fromMock).toHaveBeenCalledWith("zp_postings");
    expect(eqMock).toHaveBeenCalledWith("id", "prop-1");
    expect(upsertMock).toHaveBeenCalled();
    expect(result).toEqual({ action: "inserted", id: "prop-1" });
  });

  it("rejects update when property id belongs to another tenant", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: "prop-1", tenant_id: "tenant-2" }, error: null });

    await expect(
      upsertPropertyForTenant("tenant-1", {
        id: "prop-1",
        url: "https://example.com/1",
        title: "Depto",
        operation_type: "venta",
        price_amount: 100000,
        price_currency: "USD",
        real_estate_type: "departamento",
        address_name: "Palermo",
      }),
    ).rejects.toThrow("Property id already belongs to another tenant");
  });
});
