import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { type Lead, type CreateLeadInput, type UpdateLeadInput, type SourceType } from "../types/types.js";

export { type Lead, type CreateLeadInput, type UpdateLeadInput, type SourceType };

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment");
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function createLead(input: CreateLeadInput): Promise<number> {
  console.log("📝 createLead input:", input);
  const client = getSupabaseClient();
  
  const insertData = {
    tenant_id: input.tenant_id,
    visitor_id: input.visitor_id,
    source_type: input.source_type,
    operacion: input.operacion ?? null,
    zona: input.zona ?? null,
    presupuesto_max: input.presupuesto_max ?? null,
    nombre: input.nombre ?? null,
    contacto: input.contacto ?? null,
    summary: input.summary ?? null,
  };
  console.log("📝 createLead insertData:", insertData);
  
  const { data, error } = await client
    .from("leads")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  return data.id;
}

export async function updateLead(leadId: number, tenant_id: string | null, patch: UpdateLeadInput): Promise<void> {
  console.log("📝 updateLead called with leadId:", leadId, "patch:", patch);
  const client = getSupabaseClient();
  
  const updateData: Record<string, any> = {};
  
  if (patch.operacion !== undefined) updateData.operacion = patch.operacion;
  if (patch.zona !== undefined) updateData.zona = patch.zona;
  if (patch.presupuesto_max !== undefined) updateData.presupuesto_max = patch.presupuesto_max;
  if (patch.nombre !== undefined) updateData.nombre = patch.nombre;
  if (patch.contacto !== undefined) updateData.contacto = patch.contacto;
  if (patch.summary !== undefined) updateData.summary = patch.summary;

  console.log("📝 updateLead updateData:", updateData);
  
  if (Object.keys(updateData).length === 0) return;

  let query = client
    .from("leads")
    .update(updateData)
    .eq("id", leadId);
  
  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to update lead: ${error.message}`);
  }
}

export async function getLeadByVisitorId(visitorId: string, tenant_id: string | null): Promise<Lead | null> {
  const client = getSupabaseClient();
  
  let query = client
    .from("leads")
    .select("*");
    
  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data, error } = await query
    .eq("visitor_id", visitorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get lead: ${error.message}`);
  }

  return data;
}

export async function getLeadById(leadId: number, tenant_id: string | null): Promise<Lead | null> {
  const client = getSupabaseClient();
  
  let query = client
    .from("leads")
    .select("*");
    
  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data, error } = await query
    .eq("id", leadId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get lead: ${error.message}`);
  }

  return data;
}

export async function getAllLeads(tenant_id: string | null): Promise<Lead[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from("leads")
    .select("*");

  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get leads: ${error.message}`);
  }

  return data || [];
}

export async function getLeadsPage(tenant_id: string | null, page = 1, limit = 10): Promise<{ items: Lead[]; total: number }> {
  const client = getSupabaseClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 10;
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  let query = client
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get leads page: ${error.message}`);
  }

  return {
    items: data || [],
    total: count || 0,
  };
}

export async function deleteLead(leadId: number, tenant_id: string | null): Promise<void> {
  const client = getSupabaseClient();
  
  let query = client
    .from("leads")
    .delete()
    .eq("id", leadId);
    
  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { error } = await query;

  if (error) {
    throw new Error(`Failed to delete lead: ${error.message}`);
  }
}

export async function listLeads(tenant_id: string | null, limit = 50): Promise<Lead[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list leads: ${error.message}`);
  }

  return data || [];
}

export async function listLeadsBySourceType(
  tenant_id: string | null,
  sourceType: SourceType, 
  limit = 50
): Promise<Lead[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from("leads")
    .select("*")
    .eq("source_type", sourceType)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list leads by source: ${error.message}`);
  }

  return data || [];
}
