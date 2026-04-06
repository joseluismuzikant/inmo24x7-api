import { Property, Operation } from "../types/types.js";
import { getSupabaseClient } from "../lib/supabase.js";

const propertiesCacheByTenant = new Map<string, Property[]>();

function parseOperacion(operationType: string): Operation | null {
  const normalized = operationType.toLowerCase().trim();
  if (normalized === "venta") return "venta";
  if (normalized === "alquiler") return "alquiler";
  return null;
}

async function loadPropertiesDB(tenant_id: string): Promise<Property[]> {
  if (propertiesCacheByTenant.has(tenant_id)) {
    return propertiesCacheByTenant.get(tenant_id)!;
  }

  const client = getSupabaseClient();
  
  const { data: postings, error } = await client
    .from("zp_postings")
    .select(`
      id,
      tenant_id,
      url,
      title,
      operation_type,
      price_amount,
      price_currency,
      real_estate_type,
      description,
      address_name,
      location_name,
      city_name,
      state_acronym,
      latitude,
      longitude,
      status,
      publisher_name,
      publisher_url,
      whatsapp,
      main_features,
      general_features
    `)
    .eq("tenant_id", tenant_id);

  if (error) {
    console.error("❌ Error fetching from Supabase:", error);
    throw new Error(`Failed to fetch properties from Supabase: ${error.message}`);
  }

  if (!postings || postings.length === 0) {
    console.warn("⚠️ No properties found in Supabase");
    return [];
  }

  const properties: Property[] = postings
    .map((posting: any, idx: number): Property | null => {
      const operacion = parseOperacion(posting.operation_type || "");
      if (!operacion) return null;

      const zona = posting.location_name || posting.city_name || "Desconocida";
      if (!zona || zona === "Desconocida") return null;

      const precio = Number(posting.price_amount) || 0;
      if (!precio) return null;

      const currency = posting.price_currency || "USD";
      const precioARS = currency === "USD" ? precio * 1000 : precio;

      const mainFeatures = posting.main_features || {};
      const generalFeatures = posting.general_features || {};

      return {
        id: posting.id || `SB-${idx.toString().padStart(6, "0")}`,
        posting_id: posting.id,
        operacion,
        zona: zona.trim(),
        zona2: posting.city_name,
        zona3: posting.state_acronym,
        precio: precioARS,
        currency,
        titulo: (posting.title || "Sin título").trim(),
        description: posting.description,
        link: posting.url,
        url: posting.url,
        disponible: posting.status?.toLowerCase() === "online",
        estatus: posting.status,
        tipo: posting.real_estate_type,
        ambientes: mainFeatures.ambientes || generalFeatures.ambientes,
        banos: mainFeatures.banos || generalFeatures.banos,
        dormitorios: mainFeatures.dormitorios || generalFeatures.dormitorios,
        address: posting.address_name,
        latitude: posting.latitude,
        longitude: posting.longitude,
        seller_name: posting.publisher_name,
        seller_url: posting.publisher_url,
        phone1: posting.whatsapp,
        development_features: posting.general_features,
      };
    })
    .filter((p): p is Property => p !== null);

  propertiesCacheByTenant.set(tenant_id, properties);
  console.log(`✅ Loaded ${properties.length} properties from Supabase for tenant ${tenant_id}`);
  return properties;
}

export async function getAllProperties(tenant_id: string | null): Promise<Property[]> {
  const client = getSupabaseClient();
  
  let query = client
    .from("zp_postings")
    .select(`
      id, url, title, operation_type, price_amount, price_currency,
      tenant_id,
      real_estate_type, description, address_name, location_name,
      city_name, state_acronym, latitude, longitude, status,
      publisher_name, publisher_url, whatsapp, main_features, general_features
    `);

  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data: postings, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`);
  }

  if (!postings) return [];

  const tenantNamesById = await getTenantNamesById(postings.map((posting: any) => posting.tenant_id));

  return postings
    .map((posting: any) => mapPostingToProperty({
      ...posting,
      tenant_name: tenantNamesById.get(posting.tenant_id) || null,
    }))
    .filter((p): p is Property => p !== null);
}

export async function getPropertiesPage(tenant_id: string | null, page = 1, limit = 10): Promise<{ items: Property[]; total: number }> {
  const client = getSupabaseClient();
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : 10;
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  let query = client
    .from("zp_postings")
    .select(
      `
      id, url, title, operation_type, price_amount, price_currency,
      tenant_id,
      real_estate_type, description, address_name, location_name,
      city_name, state_acronym, latitude, longitude, status,
      publisher_name, publisher_url, whatsapp, main_features, general_features
    `,
      { count: "exact" }
    )
    .order("id", { ascending: false })
    .range(from, to);

  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }

  const { data: postings, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch properties page: ${error.message}`);
  }

  const tenantNamesById = await getTenantNamesById((postings || []).map((posting: any) => posting.tenant_id));

  return {
    items: (postings || [])
      .map((posting: any) => mapPostingToProperty({
        ...posting,
        tenant_name: tenantNamesById.get(posting.tenant_id) || null,
      }))
      .filter((p): p is Property => p !== null),
    total: count || 0,
  };
}

export async function searchPropertiesInSupabase(args: {
  tenant_id: string | null;
  operacion: Operation;
  zona: string;
  limit?: number;
}): Promise<Property[]> {
  const { tenant_id, operacion, zona, limit = 10 } = args;
  
  console.log(`🔍 Searching Supabase: tenant=${tenant_id}, operacion=${operacion}, zona=${zona}`);
  const client = getSupabaseClient();
  
  // Query with filters at database level
  let query = client
    .from("zp_postings")
    .select(`
      id,
      url,
      title,
      operation_type,
      price_amount,
      price_currency,
      real_estate_type,
      description,
      address_name,
      location_name,
      city_name,
      state_acronym,
      latitude,
      longitude,
      status,
      publisher_name,
      publisher_url,
      whatsapp,
      main_features,
      general_features
    `);
    
  if (tenant_id) {
    query = query.eq("tenant_id", tenant_id);
  }
  
  const { data: postings, error } = await query
    .eq("location_name", zona)
    .eq("operation_type", operacion.charAt(0).toUpperCase() + operacion.slice(1))
    .limit(limit);

  if (error) {
    console.error("❌ Error querying Supabase:", error);
    // Fallback logic
    return [];
  }

  console.log(`✅ Supabase query returned: ${postings?.length || 0} rows`);

  if (!postings || postings.length === 0) {
    console.log("⚠️ No results from filtered query");
    return [];
  }
  
  return postings.map(mapPostingToProperty).filter((p): p is Property => p !== null);
}

export async function upsertPropertyForTenant(tenantId: string, property: Record<string, any>): Promise<{ action: "inserted" | "updated"; id: string }> {
  const client = getSupabaseClient();
  const propertyId = String(property.id || "").trim();
  if (!propertyId) {
    throw new Error("Property id is required");
  }

  const { data: existing, error: existingError } = await client
    .from("zp_postings")
    .select("id, tenant_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to verify existing property: ${existingError.message}`);
  }

  if (existing?.tenant_id && existing.tenant_id !== tenantId) {
    throw new Error("Property id already belongs to another tenant");
  }

  const payload = {
    id: propertyId,
    tenant_id: tenantId,
    source: property.source || property.raw_json?.source || "manual_upload",
    posting_code: property.posting_code || null,
    url: String(property.url || "").trim(),
    title: String(property.title || "").trim(),
    operation_type: String(property.operation_type || "").trim().toLowerCase(),
    operation_type_id: property.operation_type_id || null,
    price_amount: Number(property.price_amount),
    price_currency: String(property.price_currency || "").trim().toUpperCase(),
    expenses_amount: property.expenses_amount !== undefined && property.expenses_amount !== null
      ? Number(property.expenses_amount)
      : null,
    expenses_currency: property.expenses_currency ? String(property.expenses_currency).trim().toUpperCase() : null,
    real_estate_type: String(property.real_estate_type || "").trim(),
    real_estate_type_id: property.real_estate_type_id || null,
    description: property.description || null,
    address_name: String(property.address_name || "").trim(),
    location_id: property.location_id || null,
    location_name: property.location_name || null,
    city_name: property.city_name || null,
    state_acronym: property.state_acronym || null,
    country_name: property.country_name || null,
    latitude: property.latitude !== undefined ? Number(property.latitude) : null,
    longitude: property.longitude !== undefined ? Number(property.longitude) : null,
    status: property.status || "active",
    posting_type: property.posting_type || null,
    premier: property.premier ?? null,
    publisher_id: property.publisher_id || null,
    publisher_name: property.publisher_name || null,
    publisher_url: property.publisher_url || null,
    publisher_type_id: property.publisher_type_id || null,
    publisher_slug: property.publisher_slug || null,
    publisher_premier: property.publisher_premier ?? null,
    whatsapp: property.whatsapp || null,
    modified_date: property.modified_date || null,
    main_features: property.main_features && typeof property.main_features === "object" ? property.main_features : {},
    general_features: property.general_features && typeof property.general_features === "object" ? property.general_features : {},
    development_features: property.development_features && typeof property.development_features === "object" ? property.development_features : {},
    highlighted_features: property.highlighted_features && typeof property.highlighted_features === "object" ? property.highlighted_features : {},
    flags_features: property.flags_features && typeof property.flags_features === "object" ? property.flags_features : {},
    raw_json: property.raw_json && typeof property.raw_json === "object" ? property.raw_json : {},
  };

  const { error: upsertError } = await client
    .from("zp_postings")
    .upsert(payload, { onConflict: "id" });

  if (upsertError) {
    throw new Error(`Failed to upsert property: ${upsertError.message}`);
  }

  clearPropertiesCache(tenantId);

  return {
    action: existing ? "updated" : "inserted",
    id: propertyId,
  };
}

export async function deletePropertyById(
  propertyId: string,
  options: { tenantId?: string | null; isAdmin: boolean }
): Promise<{ deleted: true; id: string }> {
  const client = getSupabaseClient();
  const id = String(propertyId || "").trim();
  if (!id) {
    throw new Error("INVALID_PROPERTY_ID");
  }

  let query = client.from("zp_postings").delete().eq("id", id);
  if (!options.isAdmin) {
    query = query.eq("tenant_id", options.tenantId || "");
  }

  const { data, error } = await query.select("id, tenant_id").maybeSingle();
  if (error) {
    throw new Error(`Failed to delete property: ${error.message}`);
  }
  if (!data) {
    throw new Error("PROPERTY_NOT_FOUND");
  }

  if (options.isAdmin) {
    clearPropertiesCache();
  } else if (options.tenantId) {
    clearPropertiesCache(options.tenantId);
  }

  return { deleted: true, id };
}

function mapPostingToProperty(posting: any): Property | null {
  const operacion = parseOperacion(posting.operation_type || "");
  if (!operacion) return null;

  const zona = posting.location_name || posting.city_name || "Desconocida";
  if (!zona || zona === "Desconocida") return null;

  const precio = Number(posting.price_amount) || 0;
  if (!precio) return null;

  const currency = posting.price_currency || "USD";
  const precioARS = currency === "USD" ? precio * 1000 : precio;

  const mainFeatures = posting.main_features || {};
  const generalFeatures = posting.general_features || {};

  return {
    id: posting.id,
    tenant_id: posting.tenant_id ?? null,
    tenant_name: posting.tenant_name ?? null,
    posting_id: posting.id,
    operacion,
    zona: zona.trim(),
    zona2: posting.city_name,
    zona3: posting.state_acronym,
    precio: precioARS,
    currency,
    titulo: (posting.title || "Sin título").trim(),
    description: posting.description,
    link: posting.url,
    url: posting.url,
    disponible: posting.status?.toLowerCase() === "online",
    estatus: posting.status,
    tipo: posting.real_estate_type,
    ambientes: mainFeatures.ambientes || generalFeatures.ambientes,
    banos: mainFeatures.banos || generalFeatures.banos,
    dormitorios: mainFeatures.dormitorios || generalFeatures.dormitorios,
    address: posting.address_name,
    latitude: posting.latitude,
    longitude: posting.longitude,
    seller_name: posting.publisher_name,
    seller_url: posting.publisher_url,
    phone1: posting.whatsapp,
    development_features: posting.general_features,
  };
}

async function getTenantNamesById(tenantIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const ids = Array.from(new Set(tenantIds.filter((id): id is string => Boolean(id))));
  if (!ids.length) {
    return new Map();
  }

  const client = getSupabaseClient();
  const { data, error } = await client.from("tenants").select("id, name").in("id", ids);
  if (error || !data) {
    return new Map();
  }

  return new Map(data.map((tenant: any) => [tenant.id, tenant.name]));
}

export function clearPropertiesCache(tenant_id?: string): void {
  if (tenant_id) {
    propertiesCacheByTenant.delete(tenant_id);
  } else {
    propertiesCacheByTenant.clear();
  }
}

export function getPropertiesCount(tenant_id: string): number {
  return propertiesCacheByTenant.get(tenant_id)?.length || 0;
}
