export type Operation = "venta" | "alquiler";

export type SourceType = 'web_chat' | 'whatsapp' | 'form' | 'backoffice';

export type Lead = {
  id: number;
  tenant_id: string;
  visitor_id: string;
  source_type: SourceType;
  operacion: string | null;
  zona: string | null;
  presupuesto_max: number | null;
  nombre: string | null;
  contacto: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateLeadInput = {
  tenant_id: string;
  visitor_id: string;
  source_type: SourceType;
  operacion?: "venta" | "alquiler";
  zona?: string;
  presupuesto_max?: number;
  nombre?: string;
  contacto?: string;
  summary?: string;
};

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, "tenant_id" | "visitor_id" | "source_type">>;

export type Property = {
  // Identificación
  id: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  posting_id?: string;
  
  // Información básica
  operacion: Operation;
  zona: string;
  zona2?: string;
  zona3?: string;
  precio: number;
  currency: string;
  titulo: string;
  generatedTitle?: string;
  description?: string;
  link?: string;
  url?: string;
  disponible: boolean;
  estatus?: string;
  
  // Imágenes
  imagenes?: string[];
  numero_de_imagenes?: number;
  
  // Características de la propiedad
  tipo?: string;
  ambientes?: number;
  banos?: number;
  dormitorios?: number;
  dimension_terreno?: string;
  dimension_propiedad?: string;
  nueva_usada?: string;
  
  // Ubicación
  address?: string;
  latitude?: number;
  longitude?: number;
  
  // Publicación
  fecha_de_publicacion?: string;
  visualizaciones?: number;
  
  // Vendedor
  tipovendedor?: string;
  seller_name?: string;
  seller_id?: string;
  seller_url?: string;
  phone1?: string;
  phone2?: string;
  seller_level?: string;
  
  // Extras
  development_features?: Record<string, any>;
  superdestacado?: string;
  premium_label?: string;
  proveedor_tour?: string;
  expenses?: string;
};

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type SessionState = {
  // 👇 flujo actual (NO lo tocamos todavía)
  step: "start" | "ask_operation" | "ask_zone" | "ask_budget" | "show_results" | "handoff";

  // 👇 datos estructurados (nuevo)
  data?: {
    operacion?: "venta" | "alquiler";
    zona?: string;
    presupuestoMax?: number;
    nombre?: string;
    contacto?: string;
  };

  // 👇 persistencia
  leadId?: number;

  // 👇 opcional (IA)
  history?: ChatMsg[];

  // 👇 legacy (si lo usás)
  lastProperties?: Property[];
};

export type BotReply = {
  messages: string[];
  handoff?: {
    summary: string;
  };
};
