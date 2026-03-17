Quiero implementar en este repo una funcionalidad de onboarding de tenant desde la API y otra para gestionar tenant_channels.

Contexto del proyecto:
- Backend Node + TypeScript + Express + Supabase
- Ya existe autenticación con req.user
- req.user ya incluye:
  - id
  - email
  - tenant_id
  - role
  - is_admin
- Un admin global se identifica con:
  - req.user.is_admin === true
- Ya existe adminRouter en:
  - src/routes/admin.ts
- Ya existe cliente Supabase admin en:
  - src/lib/supabase.ts
- Ya existe middleware auth corriendo antes de adminRouter
- No quiero refactor grande, solo cambio mínimo y prolijo

Base de datos ya existente:
- public.tenants
- public.profiles
- public.tenant_channels
- public.tenant_plans
- public.audit_log

Quiero agregar estos endpoints:

1. POST /admin/onboard
2. POST /admin/tenants/:id/channels
3. GET /admin/tenants/:id/channels
4. PATCH /admin/channels/:channelId

Regla general:
- todos estos endpoints deben permitir acceso solo si req.user?.is_admin === true
- si no, devolver 403 JSON

====================
1) Endpoint POST /admin/onboard
====================

Objetivo:
Crear tenant + owner + plan en un solo flujo.

Payload esperado:
```json
{
  "tenant": {
    "name": "Inmobiliaria Lopez",
    "slug": "inmobiliaria-lopez",
    "contact_name": "Juan Lopez",
    "contact_email": "juan@lopez.com",
    "contact_phone": "54911...",
    "company_name": "Lopez Propiedades",
    "brand_name": "Lopez",
    "address": "Calle 123",
    "city": "CABA",
    "province": "Buenos Aires",
    "country": "AR",
    "logo_url": null,
    "website_url": null,
    "settings": {}
  },
  "owner": {
    "email": "owner@lopez.com",
    "password": "Temp123456!"
  },
  "plan": {
    "plan_code": "free",
    "status": "trial",
    "limits": {}
  }
}
````

Comportamiento esperado:

1. validar payload
2. verificar que el slug no exista
3. insertar tenant en public.tenants
4. crear usuario en Supabase Auth con admin API:

   * supabase.auth.admin.createUser
   * email
   * password
   * email_confirm: true
5. insertar profile en public.profiles:

   * user_id = auth user id
   * tenant_id = tenant creado
   * role = 'owner'
   * is_admin = false
6. insertar tenant_plans:

   * tenant_id
   * plan_code
   * status
   * limits
7. insertar audit_log:

   * actor_user_id = req.user.id
   * actor_type = 'admin'
   * action = 'tenant_onboarded'
   * entity_type = 'tenant'
   * entity_id = tenant id
   * payload con owner_email y slug
8. devolver JSON:

```json
{
  "tenant_id": "...",
  "owner_user_id": "...",
  "owner_email": "owner@lopez.com"
}
```

Errores a manejar:

* slug duplicado => 409
* email existente / createUser falla => 409 o 400
* payload inválido => 400
* no admin => 403
* si falla algo después de crear tenant o auth user:

  * cleanup best effort:

    * borrar auth user creado
    * borrar tenant creado
  * loggear error en consola

No usar ADMIN_TOKEN.
Esto debe funcionar con el usuario logueado del backoffice admin.

====================
2) Endpoint POST /admin/tenants/:id/channels
============================================

Objetivo:
Crear un canal de notificación para un tenant.

Payload esperado:

```json
{
  "type": "email",
  "event": "new_lead",
  "name": "email principal",
  "destination": "ventas@cliente.com",
  "config": {},
  "is_active": true,
  "is_default": true
}
```

Comportamiento esperado:

1. validar tenant existe
2. insertar en public.tenant_channels
3. si is_default = true:

   * apagar otros defaults del mismo tenant_id + event + type
4. insertar audit_log:

   * action = 'tenant_channel_created'
   * entity_type = 'tenant_channel'
   * entity_id = id del channel

====================
3) Endpoint GET /admin/tenants/:id/channels
===========================================

Objetivo:
Listar los canales del tenant.

Comportamiento esperado:

* devolver channels del tenant ordenados por created_at desc

====================
4) Endpoint PATCH /admin/channels/:channelId
============================================

Objetivo:
Actualizar un channel existente.

Payload esperado:

* permitir actualizar:

  * name
  * destination
  * config
  * is_active
  * is_default

Comportamiento esperado:

1. actualizar el channel
2. si is_default = true:

   * apagar otros defaults del mismo tenant/event/type
3. insertar audit_log:

   * action = 'tenant_channel_updated'

====================
Cómo implementarlo
==================

Quiero que hagas el cambio mínimo y prolijo en este repo real.

Preferencia de estructura:

* agregar lógica en un service nuevo:

  * src/services/adminOnboardingService.ts
* agregar rutas nuevas en:

  * src/routes/admin.ts
* no romper lo existente en /admin/leads
* usar getSupabaseClient() existente
* si hace falta, agregar helpers chicos
* si ya existe zod, podés usarlo; si no, hacé validación manual mínima
* respetar imports ESM con .js

También quiero:

* agregar documentación Swagger para estos endpoints
* devolver JSON claro
* mostrar qué archivos tocaste
* si encontrás edge cases reales, resolverlos con el menor cambio posible

No hacer refactor grande.
No romper auth actual.
No romper swagger actual.
No romper rutas existentes.
