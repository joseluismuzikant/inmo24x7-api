import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getProfileByUserId } from "../repositories/userRepo.js";

export interface CurrentUserProfile {
  id: string;
  email?: string;
  tenant_id: string | null;
  role: string | null;
  is_admin: boolean;
}

export async function getCurrentUserProfile(req: AuthenticatedRequest): Promise<CurrentUserProfile> {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error("Unauthorized - No user in request");
  }

  const profile = await getProfileByUserId(userId);

  return {
    id: userId,
    email: req.user?.email,
    tenant_id: profile.tenant_id,
    role: profile.role,
    is_admin: profile.is_admin,
  };
}

export function getTenantId(req: AuthenticatedRequest): string | null {
  return req.user?.tenant_id ?? null;
}

export function getTenantIdForQuery(req: AuthenticatedRequest): string | null {
  if (req.user?.is_admin) {
    return (req.query.tenant_id as string | undefined) ?? null;
  }
  const tenant_id = req.user?.tenant_id;
  if (!tenant_id) {
    throw new Error("Unauthorized - No tenant_id");
  }
  return tenant_id;
}

export function getLeadIdFromParams(req: AuthenticatedRequest): number | null {
  const leadId = Number(req.params.id);
  return isNaN(leadId) ? null : leadId;
}

export function requireTenantId(req: AuthenticatedRequest): string {
  const tenant_id = getTenantId(req);
  if (!tenant_id) {
    throw new Error("Unauthorized - No tenant_id");
  }
  return tenant_id;
}

export function requireLeadId(req: AuthenticatedRequest): number {
  const leadId = getLeadIdFromParams(req);
  if (!leadId) {
    throw new Error("Invalid lead ID");
  }
  return leadId;
}
