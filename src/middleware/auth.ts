// src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import { getAuthUser, SourceType } from "../repositories/userRepo.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    tenant_id?: string | null;
    role?: string | null;
    is_admin: boolean;
    source_type?: SourceType;
    [key: string]: any;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  if (req.path.startsWith("/api-docs")) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7) || '';

  if (!token || !authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized - No token provided" });
    return;
  }

  try {
    const authUser = await getAuthUser(token);
    const headerSourceType = req.headers['x-source-type'] as SourceType;
    
    req.user = {
      id: authUser.id,
      email: authUser.email,
      tenant_id: authUser.tenant_id,
      role: authUser.role,
      is_admin: authUser.is_admin,
      source_type: headerSourceType || 'web_chat',
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Unauthorized - Invalid token" });
  }
}
