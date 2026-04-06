import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, selectMock, orderMock, supabaseMock } = vi.hoisted(() => {
  const order = vi.fn();
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  const supabase = { from };
  return {
    fromMock: from,
    selectMock: select,
    orderMock: order,
    supabaseMock: supabase,
  };
});

vi.mock("../../src/lib/supabase.js", () => ({
  getSupabaseClient: () => supabaseMock,
}));

import { listTenantPlans } from "../../src/services/adminTenants.ts";

describe("adminTenants service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tenant plans list", async () => {
    orderMock.mockResolvedValue({ data: [{ plan_code: "free" }], error: null });

    const result = await listTenantPlans();

    expect(fromMock).toHaveBeenCalledWith("tenant_plans");
    expect(selectMock).toHaveBeenCalled();
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([{ plan_code: "free" }]);
  });

  it("throws when query fails", async () => {
    orderMock.mockResolvedValue({ data: null, error: new Error("db down") });

    await expect(listTenantPlans()).rejects.toThrow("db down");
  });
});
