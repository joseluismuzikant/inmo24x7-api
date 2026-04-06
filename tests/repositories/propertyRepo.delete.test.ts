import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fromMock,
  deleteMock,
  eqMock,
  selectMock,
  maybeSingleMock,
  supabaseMock,
} = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const select = vi.fn(() => ({ maybeSingle }));
  const secondEq = vi.fn(() => ({ select }));
  const firstEq = vi.fn(() => ({ eq: secondEq, select }));
  const deleteFn = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ delete: deleteFn }));

  return {
    fromMock: from,
    deleteMock: deleteFn,
    eqMock: { firstEq, secondEq },
    selectMock: select,
    maybeSingleMock: maybeSingle,
    supabaseMock: { from },
  };
});

vi.mock("../../src/lib/supabase.js", () => ({
  getSupabaseClient: () => supabaseMock,
}));

import { deletePropertyById } from "../../src/repositories/propertyRepo.ts";

describe("propertyRepo delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingleMock.mockResolvedValue({ data: { id: "prop-1", tenant_id: "tenant-1" }, error: null });
  });

  it("deletes property scoped by tenant for tenant users", async () => {
    const result = await deletePropertyById("prop-1", { tenantId: "tenant-1", isAdmin: false });

    expect(fromMock).toHaveBeenCalledWith("zp_postings");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(eqMock.firstEq).toHaveBeenCalledWith("id", "prop-1");
    expect(eqMock.secondEq).toHaveBeenCalledWith("tenant_id", "tenant-1");
    expect(selectMock).toHaveBeenCalledWith("id, tenant_id");
    expect(result).toEqual({ deleted: true, id: "prop-1" });
  });

  it("throws when property does not exist", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(deletePropertyById("prop-x", { tenantId: "tenant-1", isAdmin: false })).rejects.toThrow(
      "PROPERTY_NOT_FOUND"
    );
  });
});
