import { Property, Operation } from "../types/types.js";
import { loadPropertiesFromCSV } from "./propertyLoader.js";
import { loadPropertiesFromJson } from "./propertyLoader.js";
import { loadPropertiesFromSupabase, searchPropertiesInSupabase } from "./propertyLoaderSupabase.js";

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

export async function searchProperties(args: {
  operacion: Operation;
  zona: string;
  presupuestoMax: number;
  limit?: number;
}): Promise<SearchResult> {
  const { operacion, zona, presupuestoMax, limit = 10 } = args;
  
  console.log(`🔍 searchProperties: ${operacion} in ${zona}, budget $${presupuestoMax}`);
  
  const loaderType = getLoaderType();
  let properties: Property[] = [];
  
  if (loaderType === "supabase") {
    // Use database-level filtering for Supabase
    properties = await searchPropertiesInSupabase({ operacion, zona, limit });
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
