import { Router } from "express";
import { getAllProperties } from "../repositories/propertyRepo.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";
import { getTenantIdForQuery } from "../services/userService.js";

export const propertiesRouter = Router();

/**
 * @swagger
 * /api/properties:
 *   get:
 *     summary: Get all properties
 *     description: Retrieve a list of all properties, optionally filtered by tenant (for admins).
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *         description: Tenant ID (optional, for admin)
 *     responses:
 *       200:
 *         description: List of properties retrieved successfully
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
