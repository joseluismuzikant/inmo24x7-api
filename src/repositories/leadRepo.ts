import db from "../db";

export type Lead = {
  id: number;
  createdAt: string;
  userId: string;
  operacion: string | null;
  zona: string | null;
  presupuestoMax: number | null;
  nombre: string | null;
  contacto: string | null;
  summary: string | null;
};

export type CreateLeadInput = {
  userId: string;
  operacion?: "venta" | "alquiler";
  zona?: string;
  presupuestoMax?: number;
  nombre?: string;
  contacto?: string;
  summary?: string;
};

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, "userId">>;

export function createLead(input: CreateLeadInput): number {
  const stmt = db.prepare(`
    INSERT INTO leads (userId, operacion, zona, presupuestoMax, nombre, contacto, summary)
    VALUES (@userId, @operacion, @zona, @presupuestoMax, @nombre, @contacto, @summary)
  `);

  const result = stmt.run({
    userId: input.userId,
    operacion: input.operacion ?? null,
    zona: input.zona ?? null,
    presupuestoMax: input.presupuestoMax ?? null,
    nombre: input.nombre ?? null,
    contacto: input.contacto ?? null,
    summary: input.summary ?? null,
  });

  return Number(result.lastInsertRowid);
}

export function updateLead(leadId: number, patch: UpdateLeadInput): void {
  const fields: string[] = [];
  const values: Record<string, any> = { leadId };

  if (patch.operacion !== undefined) {
    fields.push("operacion = @operacion");
    values.operacion = patch.operacion;
  }
  if (patch.zona !== undefined) {
    fields.push("zona = @zona");
    values.zona = patch.zona;
  }
  if (patch.presupuestoMax !== undefined) {
    fields.push("presupuestoMax = @presupuestoMax");
    values.presupuestoMax = patch.presupuestoMax;
  }
  if (patch.nombre !== undefined) {
    fields.push("nombre = @nombre");
    values.nombre = patch.nombre;
  }
  if (patch.contacto !== undefined) {
    fields.push("contacto = @contacto");
    values.contacto = patch.contacto;
  }
  if (patch.summary !== undefined) {
    fields.push("summary = @summary");
    values.summary = patch.summary;
  }

  if (fields.length === 0) return;

  const stmt = db.prepare(`
    UPDATE leads SET ${fields.join(", ")} WHERE id = @leadId
  `);

  stmt.run(values);
}

export function getLeadByUserId(userId: string): Lead | undefined {
  const stmt = db.prepare("SELECT * FROM leads WHERE userId = @userId ORDER BY createdAt DESC LIMIT 1");
  return stmt.get({ userId }) as Lead | undefined;
}

export function getLeadById(leadId: number): Lead | undefined {
  const stmt = db.prepare("SELECT * FROM leads WHERE id = @leadId");
  return stmt.get({ leadId }) as Lead | undefined;
}

export function getAllLeads(): Lead[] {
  const stmt = db.prepare("SELECT * FROM leads ORDER BY createdAt DESC");
  return stmt.all() as Lead[];
}

export function deleteLead(leadId: number): void {
  const stmt = db.prepare("DELETE FROM leads WHERE id = @leadId");
  stmt.run({ leadId });
}

export function listLeads(limit = 50) {
  return db
    .prepare(`
      SELECT *
      FROM leads
      ORDER BY createdAt DESC
      LIMIT ?
    `)
    .all(limit);
}

