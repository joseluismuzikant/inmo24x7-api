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
    role?: string;
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

  // Si auth NO es requerida (REQUIRE_AUTH='false'), usar defaults pero leer source_type del header
  if (!requireAuth) {
    const headerSourceType = req.headers['x-source-type'] as SourceType;
    req.user = {
      id: 'anonymous',
      tenant_id: process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001',
      source_type: headerSourceType || 'web_chat',
    };
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

    // Query profiles table to get tenant_id and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error(`No profile found for user ${user.id}:`, profileError);
      res.status(403).json({ error: "Forbidden - No profile found" });
      return;
    }

    if (!profile.tenant_id) {
      console.error(`No tenant_id found for user ${user.id}`);
      res.status(403).json({ error: "Forbidden - No tenant assigned" });
      return;
    }

    // Extract source_type from header (priority) or user metadata (fallback)
    const headerSourceType = req.headers['x-source-type'] as SourceType;
    const metadata = user.user_metadata || {};
    const appMetadata = user.app_metadata || {};
    
    const source_type = headerSourceType || metadata.source_type || appMetadata.source_type || 'web_chat';

    req.user = {
      id: user.id,
      email: user.email,
      tenant_id: profile.tenant_id,
      role: profile.role,
      source_type,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
}
