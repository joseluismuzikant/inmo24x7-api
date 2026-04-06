import { Router } from "express";
import { deletePropertyById, getAllProperties, getPropertiesPage } from "../repositories/propertyRepo.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { getTenantIdForQuery, requireTenantId } from "../services/userService.js";
import { importPropertiesFromJsonForTenant } from "../services/propertyService.js";

export const propertiesRouter = Router();

/**
 * @swagger
 * /api/properties/import-json:
 *   post:
 *     summary: Import properties from JSON for authenticated tenant
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [properties]
 *             properties:
 *               tenant_id:
 *                 type: string
 *                 description: Required only for admin users importing for a specific tenant
 *               properties:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, url, title, operation_type, price_amount, price_currency, real_estate_type, address_name]
 *                   properties:
 *                     id:
 *                       type: string
 *                     url:
 *                       type: string
 *                     title:
 *                       type: string
 *                     operation_type:
 *                       type: string
 *                       enum: [venta, alquiler]
 *                     price_amount:
 *                       type: number
 *                     price_currency:
 *                       type: string
 *                     real_estate_type:
 *                       type: string
 *                     address_name:
 *                       type: string
 *     responses:
 *       200:
 *         description: Import summary
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 */
propertiesRouter.post("/api/properties/import-json", async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.user?.is_admin
      ? String(req.body?.tenant_id || req.query.tenant_id || "").trim()
      : requireTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ error: "tenant_id is required for admin imports" });
    }

    const payload = { ...(req.body || {}) };
    delete payload.tenant_id;

    console.log(
      `[properties.route] import-json request user=${req.user?.id || "unknown"} admin=${Boolean(req.user?.is_admin)} tenant=${tenantId}`
    );

    const result = await importPropertiesFromJsonForTenant(tenantId, payload);
    return res.json(result);
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: error.message });
    }
    if (error.message?.includes("Invalid payload")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error importing properties:", error);
    return res.status(500).json({ error: "Failed to import properties" });
  }
});

/**
 * @swagger
 * /api/properties/{id}:
 *   delete:
 *     summary: Delete a property by id
 *     tags: [Properties]
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
 *         description: Property deleted
 *       404:
 *         description: Property not found
 *       401:
 *         description: Unauthorized
 */
propertiesRouter.delete("/api/properties/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "Invalid property id" });
    }

    const isAdmin = Boolean(req.user?.is_admin);
    const tenantId = isAdmin ? null : requireTenantId(req);
    const result = await deletePropertyById(id, { tenantId, isAdmin });
    return res.json(result);
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: error.message });
    }
    if (error.message === "PROPERTY_NOT_FOUND") {
      return res.status(404).json({ error: "Property not found" });
    }
    console.error("Error deleting property:", error);
    return res.status(500).json({ error: "Failed to delete property" });
  }
});

/**
 * @swagger
 * /api/properties:
 *   get:
 *     summary: Get all properties
 *     description: "Retrieve a list of all properties, optionally filtered by tenant (admin only). Example: /api/properties?tenant_id=<tenant_uuid>&page=1&limit=10"
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *           example: 8f8a95c5-3c1f-4f5d-90a8-2e5f2bf0a2f1
 *         description: Tenant ID (optional, for admin)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         description: Page number (optional)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 10
 *         description: Page size (optional)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 10
 *         description: Alias for limit (optional)
 *     responses:
 *       200:
 *         description: List of properties retrieved successfully (paginated when page/pageSize/limit is provided). Property items include tenant_id and tenant_name when available.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 properties:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       500:
 *         description: Server error
 */
propertiesRouter.get("/api/properties", async (req: AuthenticatedRequest, res) => {
  try {
    const tenant_id = getTenantIdForQuery(req);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || req.query.pageSize || 10);

    if (req.query.page || req.query.pageSize || req.query.limit) {
      const { items, total } = await getPropertiesPage(tenant_id, page, limit);
      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 10;
      res.json({
        items,
        properties: items,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      });
      return;
    }

    const properties = await getAllProperties(tenant_id);
    res.json({ properties });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: error.message });
    }
    console.error("Error fetching properties:", error);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});
