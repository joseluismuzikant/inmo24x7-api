import { Router } from "express";
import { getAllLeads, getLeadById, deleteLead, getLeadsPage } from "../repositories/leadRepo.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { getTenantIdForQuery, requireLeadId } from "../services/userService.js";

const leadsRouter = Router();

/**
 * @swagger
 * /api/leads:
 *   get:
 *     summary: Get all leads
 *     description: Retrieve a list of all captured leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *         description: Tenant ID (optional, for admin)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (optional)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Page size (optional)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Alias for limit (optional)
 *     responses:
 *       200:
 *         description: List of leads retrieved successfully (paginated when page/pageSize/limit is provided)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leads:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lead'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       500:
 *         description: Server error
 */
leadsRouter.get("/api/leads", async (req: AuthenticatedRequest, res) => {
  try {
    const tenant_id = getTenantIdForQuery(req);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || req.query.pageSize || 10);

    if (req.query.page || req.query.pageSize || req.query.limit) {
      const { items, total } = await getLeadsPage(tenant_id, page, limit);
      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 10;
      res.json({
        items,
        leads: items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      });
      return;
    }

    const leads = await getAllLeads(tenant_id);
    res.json({ leads });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: error.message });
    }
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

/**
 * @swagger
 * /api/leads/{id}:
 *   get:
 *     summary: Get a lead by ID
 *     description: Retrieve a specific lead by its unique identifier
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lead ID
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *         description: Tenant ID (optional, for admin)
 *     responses:
 *       200:
 *         description: Lead retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lead:
 *                   $ref: '#/components/schemas/Lead'
 *       400:
 *         description: Invalid lead ID format
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       404:
 *         description: Lead not found
 *       500:
 *         description: Server error
 */
leadsRouter.get("/api/leads/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const tenant_id = getTenantIdForQuery(req);
    const leadId = requireLeadId(req);

    const lead = await getLeadById(leadId, tenant_id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({ lead });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized") || error.message?.includes("Invalid")) {
      return res.status(error.message.includes("Unauthorized") ? 401 : 400).json({ error: error.message });
    }
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: "Failed to fetch lead" });
  }
});

/**
 * @swagger
 * /api/leads/{id}:
 *   delete:
 *     summary: Delete a lead
 *     description: Delete a lead by its unique identifier
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lead ID
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *         description: Tenant ID (optional, for admin)
 *     responses:
 *       200:
 *         description: Lead deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid lead ID format
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       500:
 *         description: Server error
 */
leadsRouter.delete("/api/leads/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const tenant_id = getTenantIdForQuery(req);
    const leadId = requireLeadId(req);

    await deleteLead(leadId, tenant_id);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized") || error.message?.includes("Invalid")) {
      return res.status(error.message.includes("Unauthorized") ? 401 : 400).json({ error: error.message });
    }
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

export { leadsRouter as leadsRouter };
