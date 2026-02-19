import { Router } from "express";
import { z } from "zod";
import { botReply } from "../services/botService.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import type { SourceType } from "../types/types";

export const messageRouter = Router();

const MessageSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1)
});

// Default values for local development
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const DEFAULT_SOURCE_TYPE: SourceType = (process.env.DEFAULT_SOURCE_TYPE as SourceType) || 'web_chat';

/**
 * @swagger
 * /message:
 *   post:
 *     summary: Send a message to the bot
 *     description: Send a user message and receive a bot response
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageRequest'
 *     responses:
 *       200:
 *         description: Bot response received successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Invalid request payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: object
 *       401:
 *         description: Unauthorized - Missing or invalid token
 */
messageRouter.post("/message", async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = MessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const { userId, text } = parsed.data;
    
    // Check if auth is required
    if (process.env.REQUIRE_AUTH === 'true' && !req.user?.tenant_id) {
      return res.status(401).json({ error: "Unauthorized - Authentication required" });
    }
    
    // Get tenant and source from auth token, or use defaults for local dev
    const tenantId = req.user?.tenant_id || DEFAULT_TENANT_ID;
    console.log(`Received message from userId: ${userId}, tenantId: ${tenantId}`); // Debug log 
    const sourceType = req.user?.source_type || DEFAULT_SOURCE_TYPE;
    
    // Log if using defaults (helpful for debugging)
    if (!req.user?.tenant_id) {
      console.log(`⚠️ Using default tenant_id: ${tenantId} (auth token missing tenant_id)`);
    }

    const reply = await botReply({ 
      userId, 
      text, 
      tenantId, 
      sourceType 
    });

    return res.json(reply);
  } catch (error: any) {
    console.error("❌ Error in /message route:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: error.message 
    });
  }
});
