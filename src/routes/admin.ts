import { Router, Response } from "express";
import { listLeads, getLeadById } from "../repositories/leadRepo.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { getTenantIdForQuery } from "../services/userService.js";
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

adminRouter.get("/admin/leads", requireAdmin, async (req: AuthenticatedRequest, res) => {
  let tenant_id: string | null;
  try { tenant_id = getTenantIdForQuery(req); } catch (e) { return res.status(401).json({ error: "Unauthorized" }); }
  const leads = await listLeads(tenant_id, 50);
  const rows = leads.map((l: any) => `<tr><td><a href="/admin/leads/${l.id}">${l.id}</a></td><td>${formatDate(l.created_at)}</td><td>${esc(l.operacion)}</td><td>${esc(l.zona)}</td><td style="text-align:right">${money(l.presupuesto_max)}</td><td>${esc(l.nombre)}</td><td>${esc(l.contacto)}</td><td class="muted">${esc(l.summary)}</td></tr>`).join("");
  res.type("html").send(`<!doctype html><html><body><h1>Leads</h1><table><thead><tr><th>ID</th><th>Fecha</th><th>Op</th><th>Zona</th><th>Presupuesto</th><th>Nombre</th><th>Contacto</th><th>Resumen</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
});

adminRouter.get("/admin/leads/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
  let tenant_id: string | null;
  try { tenant_id = getTenantIdForQuery(req); } catch (e) { return res.status(401).json({ error: "Unauthorized" }); }
  const id = Number(req.params.id);
  const lead = await getLeadById(id, tenant_id);
  if (!lead) return res.status(404).send("Not found");
  res.type("html").send(`<!doctype html><html><body><a href="/admin/leads">Volver</a><h1>Lead #${id}</h1><pre>${esc(JSON.stringify(lead, null, 2))}</pre></body></html>`);
});
