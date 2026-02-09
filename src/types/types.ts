export type Operation = "venta" | "alquiler";

export type Property = {
  id: string;
  operacion: Operation;
  zona: string;
  precio: number; // en la unidad que definas (USD o ARS)
  titulo: string;
  link?: string;
  disponible: boolean;
};

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type SessionState = {
  step: "start" | "ask_operation" | "ask_zone" | "ask_budget" | "show_results" | "handoff";
  operacion?: Operation;
  zona?: string;
  presupuestoMax?: number;
  lastProperties?: Property[];   
  history?: ChatMsg[];
};

export type BotReply = {
  messages: string[];
  handoff?: {
    summary: string;
  };
};

