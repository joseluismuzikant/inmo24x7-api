# Inmo24x7 MVP

Asistente virtual de inmobiliaria con integración de OpenAI y SQLite.

## Características

- Chatbot con OpenAI para calificar leads
- Búsqueda de propiedades según operación, zona y presupuesto
- Persistencia de leads en SQLite
- Handoff a asesor humano
- Sesiones en memoria por userId

## Arquitectura del Sistema

```mermaid
graph TD
    %% Usuarios y Entrada
    User((Cliente WhatsApp)) -->|Mensaje| Twilio[Twilio / Meta API]
    Twilio -->|Webhook| NodeServer[Backend Node.js - Railway/VPS]

    %% Procesamiento Core
    subgraph "Core App (Docker Container)"
        NodeServer <-->|Query/Insert| SQLite[(SQLite - app.db)]
        NodeServer <-->|Búsqueda Semántica| OpenAI[OpenAI API - GPT-4o-mini]
    end

    %% Capa de Datos (Scraping)
    Apify[Apify - Scraper Zonaprop] -->|JSON Results| N8N[n8n Orchestrator]
    N8N -->|POST /sync| NodeServer

    %% Automatizaciones y Notificaciones
    NodeServer -->|Trigger Event| N8N
    N8N -->|Email/WhatsApp| Agent((Agente Inmobiliario))
    N8N -->|Push Data| CRM[CRM Inmobiliario / GSheets]

    %% Capa de Persistencia (Volumen)
    SQLite --- Vol[(Persistent Volume)]
```

## Dataset

Este proyecto utiliza el dataset de propiedades de Zonaprop Argentina proporcionado por [Luminati.io](https://github.com/luminati-io/Zonaprop-Argentina-dataset-samples).

- **Fuente:** https://github.com/luminati-io/Zonaprop-Argentina-dataset-samples
- **Ubicación:** `src/data/zonaprop-argentina-dataset.csv`
- **Propiedades:** ~955 propiedades reales de Argentina
- **Zonas disponibles:** Capital Federal, GBA Norte/Sur/Oeste, Buenos Aires Costa Atlántica, Córdoba, Mendoza, Santa Fe, y más

## Fuentes de Datos de Propiedades

El sistema soporta múltiples fuentes de datos configurables mediante la variable de entorno `PROPERTY_LOADER`:

| Fuente | Valor | Descripción |
|--------|-------|-------------|
| CSV | `csv` (default) | Carga desde archivo CSV local (`src/data/zonaprop-argentina-dataset.csv`) |
| JSON | `json` | Carga desde archivo JSON local (`src/data/properties.json`) |
| Supabase | `supabase` | Carga desde base de datos Supabase en tiempo real |

### Configuración de Supabase

Para usar Supabase como fuente de datos:

1. Establece las variables en `.env`:
```env
PROPERTY_LOADER=supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
```

2. Asegúrate de tener las tablas `zp_postings` y `zp_posting_pictures` en Supabase

3. La tabla `zp_postings` debe contener las columnas: id, url, title, operation_type, price_amount, price_currency, location_name, city_name, state_acronym, latitude, longitude, status, publisher_name, whatsapp, main_features, general_features

## Requisitos

- Node.js 18+
- SQLite (incluido via better-sqlite3)

## Setup

```bash
cp .env.example .env
# Editar .env con tu OPENAI_API_KEY
npm install
npm run db:init
npm run dev
```

## Comandos disponibles

### Bot (chat)

| Comando | Descripción |
|---------|-------------|
| `/reset` | Reinicia la conversación actual y limpia la sesión del usuario |

## Endpoints API

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "ok": true,
  "service": "inmo24x7-mvp"
}
```

### Mensajes (Chat)

```http
POST /message
Content-Type: application/json

{
  "userId": "usuario-123",
  "text": "Hola, busco un departamento"
}
```

**Response:**
```json
{
  "messages": ["Hola! ¿Buscás comprar o alquilar?"],
  "handoff": {
    "summary": "Lead interesado en alquiler en Palermo"
  }
}
```

### Leads (Gestión de leads)

#### Listar todos los leads

```http
GET /api/leads
```

**Response:**
```json
{
  "leads": [
    {
      "id": 1,
      "createdAt": "2025-02-09T10:00:00.000Z",
      "userId": "usuario-123",
      "operacion": "alquiler",
      "zona": "Palermo",
      "presupuestoMax": 1500,
      "nombre": null,
      "contacto": null,
      "summary": "Lead calificado por bot"
    }
  ]
}
```

#### Obtener lead por ID

```http
GET /api/leads/:id
```

**Response:**
```json
{
  "lead": {
    "id": 1,
    "createdAt": "2025-02-09T10:00:00.000Z",
    "userId": "usuario-123",
    "operacion": "alquiler",
    "zona": "Palermo",
    "presupuestoMax": 1500,
    "nombre": null,
    "contacto": null,
    "summary": "Lead calificado por bot"
  }
}
```

**Errors:**
- `400` - Invalid lead ID
- `404` - Lead not found

#### Eliminar lead

```http
DELETE /api/leads/:id
```

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `400` - Invalid lead ID
- `500` - Failed to delete lead

### Panel de Administración (Web)

#### Ver todos los leads (Interfaz web)

```http
GET /admin/leads
```

Muestra una interfaz HTML con tabla de todos los leads capturados. Incluye:
- Listado de leads con ID, fecha, operación, zona, presupuesto, nombre, contacto y resumen
- Enlaces para ver detalle de cada lead
- Botón para refrescar la lista

#### Ver detalle de un lead (Interfaz web)

```http
GET /admin/leads/:id
```

Muestra página HTML con información detallada del lead específico.

### Archivos estáticos

```http
GET /
```

Sirve la interfaz web de chat desde `src/public/index.html`

## Scripts npm

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor en modo desarrollo con hot reload |
| `npm run build` | Compila TypeScript a JavaScript |
| `npm start` | Ejecuta el servidor compilado |
| `npm run db:init` | Inicializa la base de datos SQLite |

## Variables de entorno

```env
# OpenAI Configuration
OPENAI_API_KEY=tu_api_key_aqui
OPENAI_MODEL=gpt-4.1-mini  # opcional, default: gpt-4.1-mini

# Server Configuration
PORT=3000                  # opcional, default: 3000

# Property Loader Configuration
PROPERTY_LOADER=csv        # opciones: csv | json | supabase (default: csv)

# Supabase Configuration (required if PROPERTY_LOADER=supabase)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
```

## Estructura del proyecto

```
src/
├── index.ts              # Entry point
├── db.ts                 # Configuración SQLite
├── services/
│   ├── botService.ts     # Lógica del chatbot
│   ├── leadService.ts    # Gestión de leads
│   ├── sessionService.ts # Gestión de sesiones
│   ├── toolHandler.ts    # Manejadores de herramientas OpenAI
│   ├── toolParser.ts     # Parseo de tool calls
│   ├── propertyService.ts # Búsqueda de propiedades
│   ├── openaiClient.ts   # Cliente OpenAI
│   └── sessionStore.ts   # Almacenamiento en memoria
├── repositories/
│   └── leadRepo.ts       # Acceso a datos de leads
├── routes/
│   ├── message.ts        # Rutas de mensajes
│   └── leads.ts          # Rutas de leads
├── types/
│   └── types.ts          # Tipos TypeScript
└── public/
    └── index.html        # Interfaz web
```

## Base de datos

La aplicación usa SQLite con la tabla `leads`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER | ID autoincremental |
| createdAt | DATETIME | Fecha de creación |
| userId | TEXT | Identificador del usuario |
| operacion | TEXT | venta o alquiler |
| zona | TEXT | Zona de interés |
| presupuestoMax | REAL | Presupuesto máximo |
| nombre | TEXT | Nombre del lead |
| contacto | TEXT | Info de contacto |
| summary | TEXT | Resumen de la conversación |

La base de datos se guarda en `data/app.db`.
