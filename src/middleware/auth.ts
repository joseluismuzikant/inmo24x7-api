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

export type SourceType = 'web_chat' | 'whatsapp' | 'form' | 'backoffice';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    tenant_id?: string;
    source_type?: SourceType;
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

  // Por defecto, auth es requerida (seguro por defecto)
  // Solo se desactiva si REQUIRE_AUTH='false' explícitamente
  const requireAuth = process.env.REQUIRE_AUTH !== 'false';

  const authHeader = req.headers.authorization;

  // Si auth es requerida y no hay token, rechazar
  if (requireAuth && (!authHeader || !authHeader.startsWith("Bearer "))) {
    res.status(401).json({ error: "Unauthorized - No token provided" });
    return;
  }

  // Si auth NO es requerida (REQUIRE_AUTH='false'), skip toda la validación
  if (!requireAuth) {
    return next();
  }

  // En este punto sabemos que authHeader existe porque requireAuth=true y pasó la verificación
  const token = authHeader!.substring(7);

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
      // Invalid token - reject
      res.status(401).json({ error: "Unauthorized - Invalid token" });
      return;
    }

    // Extract tenant_id and source_type from user metadata (JWT claims)
    const metadata = user.user_metadata || {};
    const appMetadata = user.app_metadata || {};

    req.user = {
      id: user.id,
      email: user.email,
      tenant_id: metadata.tenant_id || appMetadata.tenant_id,
      source_type: metadata.source_type || appMetadata.source_type || 'web_chat',
      ...metadata,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
}
