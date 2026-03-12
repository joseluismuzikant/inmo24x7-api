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

  return postings
    .map(mapPostingToProperty)
    .filter((p): p is Property => p !== null);
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
