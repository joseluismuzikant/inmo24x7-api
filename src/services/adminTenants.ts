import { getSupabaseClient } from "../lib/supabase.js";

const supabase = getSupabaseClient();

type AuditContext = {
  actorUserId?: string | null;
  actorType?: "admin" | "tenant_user" | "system";
};

type PaginationResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const normalizeChannel = (row: any) => ({
  id: row.id,
  tenant_id: row.tenant_id,
  type: row.type,
  target: row.destination,
  destination: row.destination,
  event: row.event,
  name: row.name,
  config: row.config || {},
  is_active: Boolean(row.is_active),
  is_default: Boolean(row.is_default),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

async function logAudit(args: {
  actorUserId?: string | null;
  actorType?: "admin" | "tenant_user" | "system";
  action: string;
  entityType: string;
  entityId?: string | null;
  tenantId?: string | null;
  payload?: Record<string, any>;
}) {
  const { error } = await supabase.from("audit_log").insert([
    {
      actor_user_id: args.actorUserId || null,
      actor_type: args.actorType || "system",
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId || null,
      tenant_id: args.tenantId || null,
      payload: args.payload || {},
    },
  ]);

  if (error) {
    throw error;
  }
}

function normalizeOnboardingPayload(body: any) {
  const tenant = body?.tenant || {
    name: body?.tenant_name || body?.tenantName,
    slug: body?.tenant_slug || body?.tenantSlug,
    contact_name: body?.contact_name,
    contact_email: body?.contact_email,
    contact_phone: body?.contact_phone,
    company_name: body?.company_name,
    brand_name: body?.brand_name,
    address: body?.address,
    city: body?.city,
    province: body?.province,
    country: body?.country,
    logo_url: body?.logo_url,
    website_url: body?.website_url,
    settings: body?.settings,
    status: body?.status || "active",
  };

  const owner = body?.owner || {
    email: body?.owner_email || body?.ownerEmail,
    password: body?.owner_password || body?.ownerPassword,
  };

  const rawPlan = body?.plan;
  const plan = !rawPlan
    ? { plan_code: "free", status: "trial", limits: {} }
    : typeof rawPlan === "string"
      ? { plan_code: rawPlan, status: "trial", limits: {} }
      : {
          plan_code: rawPlan.plan_code || rawPlan.code || "free",
          status: rawPlan.status || "trial",
          limits: rawPlan.limits && typeof rawPlan.limits === "object" ? rawPlan.limits : {},
          trial_ends_at: rawPlan.trial_ends_at || null,
        };

  const channels: Array<{ type: "email" | "whatsapp"; target: string; is_default?: boolean }> = [];
  if (body?.notify_email) {
    channels.push({ type: "email", target: body.notify_email, is_default: true });
  }
  if (body?.whatsapp?.number) {
    channels.push({ type: "whatsapp", target: body.whatsapp.number });
  }
  if (Array.isArray(body?.channels)) {
    for (const channel of body.channels) {
      const type = channel?.type;
      const target = channel?.target || channel?.destination;
      if ((type === "email" || type === "whatsapp") && target) {
        channels.push({ type, target, is_default: channel?.is_default });
      }
    }
  }

  if (!tenant?.name || !tenant?.slug || !tenant?.contact_email || !tenant?.contact_phone || !owner?.email || !owner?.password || !plan?.plan_code) {
    throw new Error("INVALID_ONBOARDING_PAYLOAD");
  }

  return {
    tenant: {
      name: String(tenant.name).trim(),
      slug: String(tenant.slug).trim().toLowerCase(),
      contact_name: tenant.contact_name ? String(tenant.contact_name).trim() : null,
      contact_email: String(tenant.contact_email).trim().toLowerCase(),
      contact_phone: String(tenant.contact_phone).trim(),
      company_name: tenant.company_name ? String(tenant.company_name).trim() : null,
      brand_name: tenant.brand_name ? String(tenant.brand_name).trim() : null,
      address: tenant.address ? String(tenant.address).trim() : null,
      city: tenant.city ? String(tenant.city).trim() : null,
      province: tenant.province ? String(tenant.province).trim() : null,
      country: tenant.country ? String(tenant.country).trim().toUpperCase() : "AR",
      logo_url: tenant.logo_url ? String(tenant.logo_url).trim() : null,
      website_url: tenant.website_url ? String(tenant.website_url).trim() : null,
      settings: tenant.settings && typeof tenant.settings === "object" ? tenant.settings : {},
      status: tenant.status === "disabled" ? "disabled" : "active",
    },
    owner: {
      email: String(owner.email).trim().toLowerCase(),
      password: String(owner.password),
    },
    plan,
    channels,
  };
}

export async function onboardTenant(body: any, userId: string) {
  const { tenant, owner, plan, channels } = normalizeOnboardingPayload(body);
  
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
  const { error: planError } = await supabase.from("tenant_plans").insert([{
    tenant_id: tenantId,
    ...plan
  }]);
  if (planError) {
    await supabase.from("profiles").delete().eq("user_id", user_id);
    await supabase.auth.admin.deleteUser(user_id);
    await supabase.from("tenants").delete().eq("id", tenantId);
    throw planError;
  }

  if (channels.length) {
    const rows = channels.map((channel) => ({
      tenant_id: tenantId,
      type: channel.type,
      destination: channel.target,
      event: "new_lead",
      is_active: true,
      is_default: Boolean(channel.is_default),
      config: {},
    }));

    const { error: channelsError } = await supabase.from("tenant_channels").insert(rows);
    if (channelsError) {
      await supabase.from("tenant_plans").delete().eq("tenant_id", tenantId);
      await supabase.from("profiles").delete().eq("user_id", user_id);
      await supabase.auth.admin.deleteUser(user_id);
      await supabase.from("tenants").delete().eq("id", tenantId);
      throw channelsError;
    }
  }

  // 6. Log
  try {
    await logAudit({
      actorUserId: userId,
      actorType: "admin",
      action: "tenant_onboarded",
      entityType: "tenant",
      entityId: tenantId,
      payload: { owner_email: owner.email, slug: tenant.slug, plan_code: plan.plan_code },
    });
  } catch (auditError) {
    await supabase.from("tenant_channels").delete().eq("tenant_id", tenantId);
    await supabase.from("tenant_plans").delete().eq("tenant_id", tenantId);
    await supabase.from("profiles").delete().eq("user_id", user_id);
    await supabase.auth.admin.deleteUser(user_id);
    await supabase.from("tenants").delete().eq("id", tenantId);
    throw auditError;
  }

  return { tenant_id: tenantId, owner_user_id: user_id, owner_email: owner.email };
}

export async function createTenantChannel(tenantId: string, data: any, auditContext?: AuditContext) {
  const type = data?.type || data?.channel_type;
  const target = data?.target || data?.destination;
  const event = data?.event || "new_lead";
  if (!type || !target) {
    throw new Error("Missing fields: type and target are required");
  }

  const payload = {
    tenant_id: tenantId,
    type,
    destination: target,
    event,
    name: data?.name || null,
    is_active: data?.is_active !== undefined ? Boolean(data.is_active) : true,
    is_default: data?.is_default !== undefined ? Boolean(data.is_default) : false,
    config: data?.config || {},
  };

  const { data: channel, error } = await supabase
    .from("tenant_channels")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  const normalized = normalizeChannel(channel);
  await logAudit({
    actorUserId: auditContext?.actorUserId,
    actorType: auditContext?.actorType,
    action: "tenant_channel_created",
    entityType: "tenant_channel",
    entityId: normalized.id,
    tenantId,
    payload: {
      type: normalized.type,
      target: normalized.target,
      event: normalized.event,
      is_active: normalized.is_active,
      is_default: normalized.is_default,
    },
  });

  return normalized;
}

export async function listTenantChannels(tenantId: string) {
  const { data, error } = await supabase
    .from("tenant_channels")
    .select("*")
    .order("created_at", { ascending: false })
    .eq("tenant_id", tenantId);

  if (error) throw error;
  return (data || []).map(normalizeChannel);
}

export async function updateChannel(channelId: string, data: any, tenantId?: string, auditContext?: AuditContext) {
  const updatePayload: Record<string, any> = { ...data };
  if (updatePayload.target !== undefined) {
    updatePayload.destination = updatePayload.target;
    delete updatePayload.target;
  }
  if (updatePayload.channel_type !== undefined) {
    updatePayload.type = updatePayload.channel_type;
    delete updatePayload.channel_type;
  }

  let query = supabase
    .from("tenant_channels")
    .update(updatePayload)
    .eq("id", channelId);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: channel, error } = await query.select().single();

  if (error) throw error;
  const normalized = normalizeChannel(channel);
  await logAudit({
    actorUserId: auditContext?.actorUserId,
    actorType: auditContext?.actorType,
    action: "tenant_channel_updated",
    entityType: "tenant_channel",
    entityId: normalized.id,
    tenantId: normalized.tenant_id || tenantId || null,
    payload: updatePayload,
  });

  return normalized;
}

export async function listTenants(page = 1, limit = 10): Promise<PaginationResult<any>> {
  const safePage = toPositiveNumber(page, 1);
  const safeLimit = Math.min(100, toPositiveNumber(limit, 10));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, error, count } = await supabase
    .from("tenants")
    .select("id, name, slug, status, created_at, contact_email", { count: "exact" })
    .range(from, to)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const tenantIds = (data || []).map((tenant) => tenant.id);
  let plansByTenant = new Map<string, string>();
  if (tenantIds.length) {
    const { data: plans } = await supabase
      .from("tenant_plans")
      .select("tenant_id, plan_code")
      .in("tenant_id", tenantIds);

    plansByTenant = new Map((plans || []).map((plan) => [plan.tenant_id, plan.plan_code]));
  }

  const items = (data || []).map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    plan: plansByTenant.get(tenant.id) || "free",
    created_at: tenant.created_at,
    createdAt: tenant.created_at,
    contact_email: tenant.contact_email,
  }));

  const total = count || 0;
  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function updateTenantStatus(tenantId: string, status: "active" | "disabled", auditContext?: AuditContext) {
  const { data, error } = await supabase
    .from("tenants")
    .update({ status })
    .eq("id", tenantId)
    .select("id, name, status")
    .single();

  if (error) throw error;

  await logAudit({
    actorUserId: auditContext?.actorUserId,
    actorType: auditContext?.actorType,
    action: "tenant_status_updated",
    entityType: "tenant",
    entityId: tenantId,
    payload: { status },
  });

  return data;
}

export async function listTenantPlans() {
  const { data, error } = await supabase
    .from("tenant_plans")
    .select("tenant_id, plan_code, status, limits, trial_ends_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteTenant(tenantId: string, auditContext?: AuditContext) {
  const tablesToGuard = ["leads", "zp_postings"] as const;
  for (const table of tablesToGuard) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (error) throw error;
    if ((count || 0) > 0) {
      throw new Error(`TENANT_DELETE_BLOCKED:${table}:${count}`);
    }
  }

  const { error: channelsError } = await supabase.from("tenant_channels").delete().eq("tenant_id", tenantId);
  if (channelsError) throw channelsError;

  const { error: plansError } = await supabase.from("tenant_plans").delete().eq("tenant_id", tenantId);
  if (plansError) throw plansError;

  const { data: tenantProfiles, error: profilesFetchError } = await supabase
    .from("profiles")
    .select("user_id, is_admin")
    .eq("tenant_id", tenantId);
  if (profilesFetchError) throw profilesFetchError;

  const nonAdminUserIds = (tenantProfiles || [])
    .filter((profile) => !profile.is_admin)
    .map((profile) => profile.user_id)
    .filter(Boolean);

  for (const userId of nonAdminUserIds) {
    const { error: deleteAuthUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthUserError) {
      throw deleteAuthUserError;
    }
  }

  const { error: profilesError } = await supabase.from("profiles").delete().eq("tenant_id", tenantId);
  if (profilesError) throw profilesError;

  const { error: clearTenantRefError } = await supabase
    .from("audit_log")
    .update({ tenant_id: null })
    .eq("tenant_id", tenantId);
  if (clearTenantRefError) throw clearTenantRefError;

  const { error: tenantError } = await supabase.from("tenants").delete().eq("id", tenantId);
  if (tenantError) throw tenantError;

  await logAudit({
    actorUserId: auditContext?.actorUserId,
    actorType: auditContext?.actorType,
    action: "tenant_deleted",
    entityType: "tenant",
    entityId: tenantId,
    payload: { deleted: true },
  });

  return { deleted: true };
}
