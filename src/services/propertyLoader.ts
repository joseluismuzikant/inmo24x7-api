import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { Property, Operation } from "../types/types.js";

let propertiesCache: Property[] | null = null;

function parseOperacion(operacion: string): Operation | null {
  const normalized = operacion.toLowerCase().trim();
  if (normalized === "venta") return "venta";
  if (normalized === "alquiler") return "alquiler";
  return null;
}

export function loadPropertiesFromCSV(): Property[] {
  if (propertiesCache) {
    return propertiesCache;
  }

  const filePath = path.join(process.cwd(), "src", "data", "zonaprop-argentina-dataset.csv");
  const csv = fs.readFileSync(filePath, "utf-8");

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  const properties = rows
    .map((r: any, idx: number): Property | null => {
      const operacion = parseOperacion(r.Operacion || "");
      if (!operacion) return null;

      const zona = r.Zona3 || r.Zona2 || r.Zona || "";
      if (!zona) return null;

      const precioRaw = String(r.Precio || "").replace(/[^\d]/g, "");
      const precio = Number(precioRaw);
      if (!precio || isNaN(precio)) return null;

      const currency = r.Currency || "USD";
      
      // Convert USD to ARS for consistent comparison
      const precioARS = currency === "USD" ? precio * 1000 : precio;

      return {
        id: `ZP-${idx.toString().padStart(6, "0")}`,
        operacion,
        zona: zona.trim(),
        precio: precioARS,
        titulo: (r.generatedTitle || r.Title || "Sin título").trim(),
        link: r.url || undefined,
        disponible: true,
      };
    })
    .filter((p): p is Property => p !== null);

  propertiesCache = properties;
  console.log(`✅ Loaded ${properties.length} properties from CSV`);
  return properties;
}

export function clearPropertiesCache(): void {
  propertiesCache = null;
}

export function getPropertiesCount(): number {
  if (!propertiesCache) {
    loadPropertiesFromCSV();
  }
  return propertiesCache?.length || 0;
}
