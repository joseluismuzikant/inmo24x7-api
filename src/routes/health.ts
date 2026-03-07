import { Router } from "express";
import { getSupabaseClient } from  "../lib/supabase.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "inmo24x7-api",
  });
});

healthRouter.get("/health/supabase", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();

    const result = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    console.log("[GET /health/supabase]", JSON.stringify(result, null, 2));

    if (result.error) {
      return res.status(500).json({
        ok: false,
        supabase: false,
        error: {
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint,
          code: result.error.code,
        },
      });
    }

    return res.json({
      ok: true,
      supabase: true,
      rows: result.data?.length ?? 0,
    });
  } catch (err) {
    console.error("[GET /health/supabase] exception:", err);

    return res.status(500).json({
      ok: false,
      supabase: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});