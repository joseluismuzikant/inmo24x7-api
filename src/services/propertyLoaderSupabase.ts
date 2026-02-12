import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Property, Operation } from "../types/types.js";

let supabase: SupabaseClient | null = null;
let propertiesCache: Property[] | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment");
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

function parseOperacion(operationType: string): Operation | null {
  const normalized = operationType.toLowerCase().trim();
  if (normalized === "venta") return "venta";
  if (normalized === "alquiler") return "alquiler";
  return null;
}

export async function loadPropertiesFromSupabase(): Promise<Property[]> {
  if (propertiesCache) {
    return propertiesCache;
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
    `);

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

  propertiesCache = properties;
  console.log(`✅ Loaded ${properties.length} properties from Supabase`);
  return properties;
}

export async function searchPropertiesInSupabase(args: {
  operacion: Operation;
  zona: string;
  limit?: number;
}): Promise<Property[]> {
  const { operacion, zona, limit = 10 } = args;
  
  console.log(`🔍 Searching Supabase: operacion=${operacion}, zona=${zona}`);
  const client = getSupabaseClient();
  
  // Query with filters at database level
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
    .eq("location_name", zona)
    .eq("operation_type", operacion.charAt(0).toUpperCase() + operacion.slice(1)) // Capitalize: "alquiler" -> "Alquiler"
    .limit(limit);

  if (error) {
    console.error("❌ Error querying Supabase:", error);
    // Fallback to in-memory search
    const allProps = await loadPropertiesFromSupabase();
    return allProps.filter(p => 
      p.operacion === operacion && 
      p.zona.toLowerCase() === zona.toLowerCase()
    ).slice(0, limit);
  }

  console.log(`✅ Supabase query returned: ${postings?.length || 0} rows`);

  if (!postings || postings.length === 0) {
    console.log("⚠️ No results from filtered query, trying partial match...");
    // Try partial match
    const { data: partialPostings, error: partialError } = await client
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
      .ilike("location_name", `%${zona}%`)
      .ilike("operation_type", `%${operacion}%`)
      .limit(limit);
    
    if (partialError || !partialPostings || partialPostings.length === 0) {
      console.log("⚠️ No results from partial match either");
      return [];
    }
    
    console.log(`✅ Partial match query returned: ${partialPostings.length} rows`);
    return partialPostings.map(mapPostingToProperty).filter((p): p is Property => p !== null);
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

export function clearPropertiesCache(): void {
  propertiesCache = null;
}

export function getPropertiesCount(): number {
  return propertiesCache?.length || 0;
}
