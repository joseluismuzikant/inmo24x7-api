import { Router } from "express";
import { getAllLeads, getLeadById, deleteLead } from "../repositories/leadRepo.js";

const router = Router();

/**
 * @swagger
 * /api/leads:
 *   get:
 *     summary: Get all leads
 *     description: Retrieve a list of all captured leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leads retrieved successfully
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
router.get("/api/leads", async (_req, res) => {
  try {
    const leads = await getAllLeads();
    res.json({ leads });
  } catch (error) {
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
router.get("/api/leads/:id", async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.json({ lead });
  } catch (error) {
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
router.delete("/api/leads/:id", async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    await deleteLead(leadId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

export { router as leadsRouter };
