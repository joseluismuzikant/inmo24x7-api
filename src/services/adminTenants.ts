import { getSupabaseClient } from "../lib/supabase.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";

const supabase = getSupabaseClient();

export async function onboardTenant(body: any, userId: string) {
  const { tenant, owner, plan } = body;
  
  // 1. Verificación de slug
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenant.slug)
    .single();
  
  if (existing) throw new Error("SLUG_EXISTS");

  // 2. Insertar Tenant
  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .insert([tenant])
    .select("id")
    .single();

  if (tenantError) throw tenantError;
  const tenantId = tenantData.id;

  // 3. Crear User Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: owner.email,
    password: owner.password,
    email_confirm: true,
  });

  if (authError) {
    await supabase.from("tenants").delete().eq("id", tenantId);
    throw authError;
  }

  const user_id = authData.user.id;

  // 4. Insertar Profile
  const { error: profileError } = await supabase
  .from("profiles")
  .upsert([{
    user_id,
    tenant_id: tenantId,
    role: "owner",
    is_admin: false,
  }], { onConflict: "user_id" });

    

  if (profileError) {
    await supabase.auth.admin.deleteUser(user_id);
    await supabase.from("tenants").delete().eq("id", tenantId);
    throw profileError;
  }

  // 5. Insertar Plan
  await supabase.from("tenant_plans").insert([{
    tenant_id: tenantId,
    ...plan
  }]);

  // 6. Log
  await supabase.from("audit_log").insert([{
    actor_user_id: userId,
    actor_type: "admin",
    action: "tenant_onboarded",
    entity_type: "tenant",
    entity_id: tenantId,
    payload: { owner_email: owner.email, slug: tenant.slug }
  }]);

  return { tenant_id: tenantId, owner_user_id: user_id, owner_email: owner.email };
}

export async function createTenantChannel(tenantId: string, data: any) {
  const { data: channel, error } = await supabase
    .from("tenant_channels")
    .insert([{ tenant_id: tenantId, ...data }])
    .select()
    .single();

  if (error) throw error;
  return channel;
}

export async function listTenantChannels(tenantId: string) {
  const { data, error } = await supabase
    .from("tenant_channels")
    .select("*")
    .eq("tenant_id", tenantId);

  if (error) throw error;
  return data;
}

export async function updateChannel(channelId: string, data: any) {
  const { data: channel, error } = await supabase
    .from("tenant_channels")
    .update(data)
    .eq("id", channelId)
    .select()
    .single();

  if (error) throw error;
  return channel;
}

export async function listTenants() {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
