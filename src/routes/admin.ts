import { Router, Response } from "express";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { 
  onboardTenant, 
  createTenantChannel, 
  listTenantChannels, 
  updateChannel,
  listTenants,
  updateTenantStatus,
  listTenantPlans,
  deleteTenant,
} from "../services/adminTenants.js";
import { requireTenantId } from "../services/userService.js";

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenant, owner, plan]
 *             properties:
 *               tenant:
 *                 type: object
 *                 required: [name, slug, contact_email, contact_phone]
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: Inmobiliaria Lopez
 *                   slug:
 *                     type: string
 *                     example: inmobiliaria-lopez
 *                   contact_name:
 *                     type: string
 *                     example: Juan Lopez
 *                   contact_email:
 *                     type: string
 *                     format: email
 *                     example: juan@lopez.com
 *                   contact_phone:
 *                     type: string
 *                     example: "5491123456789"
 *                   company_name:
 *                     type: string
 *                     example: Lopez Propiedades
 *                   brand_name:
 *                     type: string
 *                     example: Lopez
 *                   address:
 *                     type: string
 *                     example: Av. Siempre Viva 123
 *                   city:
 *                     type: string
 *                     example: CABA
 *                   province:
 *                     type: string
 *                     example: Buenos Aires
 *                   country:
 *                     type: string
 *                     example: AR
 *                   logo_url:
 *                     type: string
 *                     nullable: true
 *                   website_url:
 *                     type: string
 *                     example: https://lopezpropiedades.com
 *                   settings:
 *                     type: object
 *               owner:
 *                 type: object
 *                 required: [email, password]
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: owner@lopez.com
 *                   password:
 *                     type: string
 *                     example: Temp123456!
 *               plan:
 *                 type: object
 *                 required: [plan_code]
 *                 properties:
 *                   plan_code:
 *                     type: string
 *                     example: free
 *                   status:
 *                     type: string
 *                     example: trial
 *                   limits:
 *                     type: object
 *               channels:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [type, target]
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [email, whatsapp]
 *                     target:
 *                       type: string
 *                     is_default:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Tenant onboarded
 *       400:
 *         description: Invalid onboarding payload
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Slug already exists
 */
adminRouter.post("/admin/onboard", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await onboardTenant(req.body, req.user!.id);
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.message === "INVALID_ONBOARDING_PAYLOAD") {
      return res.status(400).json({ error: "Invalid onboarding payload" });
    }
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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Channel created
 *       403:
 *         description: Forbidden
 *   get:
 *     summary: List tenant channels
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel list
 *       403:
 *         description: Forbidden
 */
adminRouter.post("/admin/tenants/:id/channels", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await createTenantChannel(req.params.id, req.body || {}, {
      actorUserId: req.user?.id,
      actorType: "admin",
    });
    return res.status(201).json(data);
  } catch (err: any) {
    if (err.message?.includes("Missing fields")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Channel updated
 *       403:
 *         description: Forbidden
 */
adminRouter.patch("/admin/channels/:channelId", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await updateChannel(req.params.channelId, req.body, undefined, {
      actorUserId: req.user?.id,
      actorType: "admin",
    });
    return res.json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /admin/tenants:
 *   get:
 *     summary: List all tenants
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Page size (default 10)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Alias for limit
 *     responses:
 *       200:
 *         description: Paginated tenant list
 *       403:
 *         description: Forbidden
 */
adminRouter.get("/admin/tenants", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || req.query.pageSize || 10);
    const data = await listTenants(page, limit);
    return res.json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

/**
 * @swagger
 * /admin/tenant-plans:
 *   get:
 *     summary: List all tenant plans
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant plans list
 *       403:
 *         description: Forbidden
 */
adminRouter.get("/admin/tenant-plans", requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await listTenantPlans();
    return res.json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /admin/tenants/{id}/status:
 *   patch:
 *     summary: Update tenant status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, disabled]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       403:
 *         description: Forbidden
 */

adminRouter.patch("/admin/tenants/:id/status", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const status = req.body?.status;
  if (status !== "active" && status !== "disabled") {
    return res.status(400).json({ error: "Invalid status. Use active or disabled" });
  }

  try {
    const data = await updateTenantStatus(req.params.id, status, {
      actorUserId: req.user?.id,
      actorType: "admin",
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /admin/tenants/{id}:
 *   delete:
 *     summary: Delete tenant
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tenant deleted
 *       409:
 *         description: Delete blocked by related records
 *       403:
 *         description: Forbidden
 */

adminRouter.delete("/admin/tenants/:id", requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await deleteTenant(req.params.id, {
      actorUserId: req.user?.id,
      actorType: "admin",
    });
    return res.json(data);
  } catch (err: any) {
    if (typeof err.message === "string" && err.message.startsWith("TENANT_DELETE_BLOCKED:")) {
      const [, table, count] = err.message.split(":");
      return res.status(409).json({
        error: `Cannot delete tenant with related ${table} records (${count})`,
      });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/tenant/channels:
 *   get:
 *     summary: List channels for authenticated tenant
 *     tags: [Tenant Channels]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Channel list
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create channel for authenticated tenant
 *     tags: [Tenant Channels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, target]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, whatsapp]
 *               target:
 *                 type: string
 *               event:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               is_default:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Channel created
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */

adminRouter.get("/api/tenant/channels", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = requireTenantId(req);
    const items = await listTenantChannels(tenantId);
    return res.json({ items });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

adminRouter.post("/api/tenant/channels", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = requireTenantId(req);
    const item = await createTenantChannel(tenantId, req.body || {}, {
      actorUserId: req.user?.id,
      actorType: req.user?.is_admin ? "admin" : "tenant_user",
    });
    return res.status(201).json(item);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized") || err.message?.includes("Missing fields")) {
      const status = err.message.includes("Unauthorized") ? 401 : 400;
      return res.status(status).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/tenant/channels/{channelId}:
 *   patch:
 *     summary: Update tenant channel
 *     tags: [Tenant Channels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               target:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               is_default:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Channel updated
 *       401:
 *         description: Unauthorized
 */

adminRouter.patch("/api/tenant/channels/:channelId", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = requireTenantId(req);
    const item = await updateChannel(req.params.channelId, req.body || {}, tenantId, {
      actorUserId: req.user?.id,
      actorType: req.user?.is_admin ? "admin" : "tenant_user",
    });
    return res.json(item);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});
