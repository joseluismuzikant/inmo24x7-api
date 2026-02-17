// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Authentication will fail."
  );
}

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ✅ Let CORS preflight pass without requiring Authorization header
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized - No token provided" });
    return;
  }

  const token = authHeader.substring(7);

  if (!supabase) {
    res.status(500).json({ error: "Authentication service not configured" });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Unauthorized - Invalid token" });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
}
