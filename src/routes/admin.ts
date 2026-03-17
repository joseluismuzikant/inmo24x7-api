import { Router, Response } from "express";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { 
  onboardTenant, 
  createTenantChannel, 
  listTenantChannels, 
  updateChannel,
  listTenants 
} from "../services/adminTenants.js";

export const adminRouter = Router();

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (req.user?.is_admin) {
    next();
  } else {
    res.status(403).json({ error: "Forbidden - Requires admin access" });
  }
};

/* =========================
   UTILS
========================= */
function esc(v: any) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function money(v: any) { const n = Number(v); return !Number.isFinite(n) ? "" : n.toLocaleString("es-AR"); }
function formatDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/* =========================
   ONBOARDING & CHANNELS
========================= */

/**
 * @swagger
 * /admin/onboard:
 *   post:
 *     summary: Onboard a new tenant
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 */
adminRouter.post("/admin/onboard", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await onboardTenant(req.body, req.user!.id);
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.message === "SLUG_EXISTS") return res.status(409).json({ error: "Slug already exists" });
    console.error("Onboarding error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /admin/tenants/{id}/channels:
 *   post:
 *     summary: Create tenant channel
 *     tags: [Admin]
 *   get:
 *     summary: List tenant channels
 *     tags: [Admin]
 */
adminRouter.post("/admin/tenants/:id/channels", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { channel_type, name, config } = req.body;
  if (!channel_type || !name) return res.status(400).json({ error: "Missing fields" });
  try {
    const data = await createTenantChannel(req.params.id, { channel_type, name, config });
    return res.status(201).json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

adminRouter.get("/admin/tenants/:id/channels", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await listTenantChannels(req.params.id);
    return res.json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /admin/channels/{channelId}:
 *   patch:
 *     summary: Update channel
 *     tags: [Admin]
 */
adminRouter.patch("/admin/channels/:channelId", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await updateChannel(req.params.channelId, req.body);
    return res.json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

adminRouter.get("/admin/tenants", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await listTenants();
    return res.json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
