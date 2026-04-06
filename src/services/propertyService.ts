import { Property, Operation } from "../types/types.js";
import { loadPropertiesFromCSV } from "./propertyLoader.js";
import { loadPropertiesFromJson } from "./propertyLoader.js";
import { searchPropertiesInSupabase, upsertPropertyForTenant } from "../repositories/propertyRepo.js";

type LoaderType = "csv" | "json" | "supabase";

function getLoaderType(): LoaderType {
  const loader = process.env.PROPERTY_LOADER?.toLowerCase();
  if (loader === "json") return "json";
  if (loader === "supabase") return "supabase";
  return "csv"; // default
}

export interface SearchResult {
  results: Property[];
  userBudget: number;
  propertiesWithinBudget: number;
}

export interface ImportPropertiesResult {
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ index: number; id?: string; message: string }>;
}

const requiredImportFields = [
  "id",
  "url",
  "title",
  "operation_type",
  "price_amount",
  "price_currency",
  "real_estate_type",
  "address_name",
] as const;

function validateImportProperty(property: any): string[] {
  return requiredImportFields.filter((field) => {
    const value = property?.[field];
    if (field === "price_amount") {
      return value === undefined || value === null || Number.isNaN(Number(value));
    }
    return value === undefined || value === null || String(value).trim() === "";
  });
}

export async function importPropertiesFromJsonForTenant(tenantId: string, payload: any): Promise<ImportPropertiesResult> {
  if (!payload || !Array.isArray(payload.properties)) {
    throw new Error("Invalid payload: expected { properties: [] }");
  }

  console.log(`[property-import] started tenant=${tenantId} total=${payload.properties.length}`);

  const result: ImportPropertiesResult = {
    total: payload.properties.length,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (let index = 0; index < payload.properties.length; index += 1) {
    const property = payload.properties[index];
    const propertyId = property?.id ? String(property.id) : undefined;
    const missingFields = validateImportProperty(property);

    if (missingFields.length) {
      console.warn(
        `[property-import] invalid item tenant=${tenantId} index=${index} id=${propertyId || "n/a"} missing=${missingFields.join(",")}`
      );
      result.failed += 1;
      result.errors.push({
        index,
        id: propertyId,
        message: `Missing/invalid required fields: ${missingFields.join(", ")}`,
      });
      continue;
    }

    try {
      const upsertResult = await upsertPropertyForTenant(tenantId, property);
      console.log(
        `[property-import] ${upsertResult.action} tenant=${tenantId} index=${index} id=${upsertResult.id}`
      );
      if (upsertResult.action === "inserted") {
        result.inserted += 1;
      } else {
        result.updated += 1;
      }
    } catch (error: any) {
      console.error(
        `[property-import] failed tenant=${tenantId} index=${index} id=${propertyId || "n/a"} reason=${error?.message || "unknown"}`
      );
      result.failed += 1;
      result.errors.push({
        index,
        id: propertyId,
        message: error?.message || "Failed to import property",
      });
    }
  }

  console.log(
    `[property-import] finished tenant=${tenantId} total=${result.total} inserted=${result.inserted} updated=${result.updated} failed=${result.failed}`
  );

  return result;
}

export async function searchProperties(args: {
  tenant_id: string;
  operacion: Operation;
  zona: string;
  presupuestoMax: number;
  limit?: number;
}): Promise<SearchResult> {
  const { tenant_id, operacion, zona, presupuestoMax, limit = 10 } = args;
  
  console.log(`🔍 searchProperties: ${operacion} in ${zona}, budget $${presupuestoMax}`);
  
  const loaderType = getLoaderType();
  let properties: Property[] = [];
  
  if (loaderType === "supabase") {
    // Use database-level filtering for Supabase
    properties = await searchPropertiesInSupabase({ tenant_id, operacion, zona, limit });
  } else {
    // Use in-memory filtering for CSV/JSON
    const allProperties = loaderType === "json" 
      ? await loadPropertiesFromJson()
      : await loadPropertiesFromCSV();
    
    const normZona = zona.trim().toLowerCase();
    properties = allProperties
      .filter((p) => p.disponible)
      .filter((p) => p.operacion === operacion)
      .filter((p) => p.zona.trim().toLowerCase().includes(normZona))
      .sort((a, b) => a.precio - b.precio)
      .slice(0, limit);
  }
  
  console.log(`✅ Found ${properties.length} properties`);
  
  const withinBudget = properties.filter((p) => p.precio <= presupuestoMax);
  
  return { 
    results: properties,
    userBudget: presupuestoMax,
    propertiesWithinBudget: withinBudget.length
  };
}
