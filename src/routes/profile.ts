import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { getCurrentUserProfile } from "../services/userService.js";

export const profileRouter = Router();

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get authenticated user profile
 *     description: Returns profile data for the current bearer token user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 tenant_id:
 *                   type: string
 *                   nullable: true
 *                 role:
 *                   type: string
 *                   nullable: true
 *                 is_admin:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
profileRouter.get("/api/profile", async (req: AuthenticatedRequest, res) => {
  try {
    const profile = await getCurrentUserProfile(req);
    return res.json(profile);
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return res.status(401).json({ error: error.message });
    }
    if (error.message?.includes("No profile found")) {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error("Error fetching current profile:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});
