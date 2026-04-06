import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, singleMock, eqMock, selectMock, fromMock, supabaseMock } = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn();
  const supabase = {
    auth: { getUser },
    from,
  };
  return {
    getUserMock: getUser,
    singleMock: single,
    eqMock: eq,
    selectMock: select,
    fromMock: from,
    supabaseMock: supabase,
  };
});

vi.mock("../../src/lib/supabase.js", () => ({
  getSupabaseClient: () => supabaseMock,
}));

import { getAuthUser } from "../../src/repositories/userRepo.ts";

describe("userRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth user with tenant profile", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@inmo24x7.com" } },
      error: null,
    });
    singleMock.mockResolvedValue({
      data: { tenant_id: "tenant-1", role: "owner", is_admin: false },
      error: null,
    });

    const result = await getAuthUser("token-1");

    expect(getUserMock).toHaveBeenCalledWith("token-1");
    expect(fromMock).toHaveBeenCalledWith("profiles");
    expect(selectMock).toHaveBeenCalledWith("tenant_id, role, is_admin");
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toEqual({
      id: "user-1",
      email: "owner@inmo24x7.com",
      tenant_id: "tenant-1",
      role: "owner",
      is_admin: false,
    });
  });

  it("throws when non-admin has no tenant assigned", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "owner@inmo24x7.com" } },
      error: null,
    });
    singleMock.mockResolvedValue({
      data: { tenant_id: null, role: "owner", is_admin: false },
      error: null,
    });

    await expect(getAuthUser("token-1")).rejects.toThrow("No tenant assigned");
  });
});
