import { Router } from "express";
import { getAllProperties, getPropertiesPage } from "../repositories/propertyRepo.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { getTenantIdForQuery } from "../services/userService.js";

export const propertiesRouter = Router();

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
