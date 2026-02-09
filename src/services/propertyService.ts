import { Property, Operation } from "../types/types.js";
import { loadPropertiesFromCSV } from "./propertyLoader.js";

export function searchProperties(args: {
  operacion: Operation;
  zona: string;
  presupuestoMax: number;
  limit?: number;
}): Property[] {
  const { operacion, zona, presupuestoMax, limit = 3 } = args;
  const properties = loadPropertiesFromCSV();

  const normZona = zona.trim().toLowerCase();

  return properties
    .filter((p) => p.disponible)
    .filter((p) => p.operacion === operacion)
    .filter((p) => p.zona.trim().toLowerCase().includes(normZona))
    .filter((p) => p.precio <= presupuestoMax)
    .sort((a, b) => a.precio - b.precio)
    .slice(0, limit);
}
