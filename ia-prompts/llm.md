Quiero adaptar mi backend para soportar roles tenant + admin global usando mi esquema actual de Supabase.

Contexto actual de DB:
- Tabla public.profiles:
  - user_id uuid pk
  - tenant_id uuid nullable
  - role text check ('owner','manager','agent','viewer')
  - is_admin boolean not null default false
- El admin global tiene:
  - is_admin = true
  - tenant_id = null permitido
- Usuario normal del tenant:
  - is_admin = false
  - tenant_id con valor
  - role dentro del tenant
- Ya actualicé las RLS policies para leads, whatsapp_numbers, zp_postings, zp_posting_pictures y tenants.

Objetivo:
Modificar el código backend para que:
1. lea tenant_id, role e is_admin desde profiles
2. no asuma que todo usuario tiene tenant_id
3. permita que un admin global vea todos los tenants y filtre por tenant
4. mantenga el comportamiento actual para usuarios normales del tenant

Necesito que hagas los cambios en el código, minimizando cambios innecesarios y sin romper lo existente.

Tareas concretas:

1. Buscar dónde se arma el usuario autenticado desde Supabase
Probablemente en algo como:
- src/repositories/userRepo.ts
- src/middleware/auth.ts

2. Actualizar el tipo AuthUser para incluir:
- id: string
- email?: string
- tenant_id?: string | null
- role?: string | null
- is_admin: boolean

3. En la lectura de profiles:
- incluir tenant_id, role, is_admin
- si el usuario NO es admin y no tiene tenant_id, devolver error
- si el usuario es admin y no tiene tenant_id, permitirlo

La lógica esperada es:

```ts
if (!profile.is_admin && !profile.tenant_id) {
  throw new Error("No tenant assigned");
}
````

4. En el middleware auth:

* agregar is_admin a req.user
* mantener tenant_id y role
* no romper source_type actual

La estructura esperada de req.user debería quedar conceptualmente así:

```ts
req.user = {
  id: authUser.id,
  email: authUser.email,
  tenant_id: authUser.tenant_id,
  role: authUser.role,
  is_admin: authUser.is_admin,
  source_type: headerSourceType || "web_chat",
};
```

5. Actualizar el tipado de Express Request para que req.user incluya:

* tenant_id?: string | null
* role?: string | null
* is_admin?: boolean

6. Buscar rutas o services que hoy hagan esto:

* lean req.user.tenant_id
* fallen si no existe tenant_id
* filtren siempre por tenant fijo

Y adaptarlas a esta lógica:

* si req.user.is_admin = true:

  * permitir consultar todo
  * o filtrar por tenant_id si viene por query param
* si req.user.is_admin = false:

  * usar siempre req.user.tenant_id
  * si no existe, devolver 401

Patrón esperado:

```ts
const requestedTenantId = req.query.tenant_id as string | undefined;

let tenantId: string | null = null;

if (req.user?.is_admin) {
  tenantId = requestedTenantId ?? null;
} else {
  tenantId = req.user?.tenant_id ?? null;
  if (!tenantId) {
    return res.status(401).json({ error: "Unauthorized - No tenant_id" });
  }
}
```

7. Actualizar repositorios de datos como leads/postings para aceptar tenantId nullable:

* si tenantId tiene valor: filtrar por tenant
* si tenantId es null y el caller ya validó que es admin: traer todos

8. No introducir lógica con muchos if repetidos.
   Si es posible, crear helpers chicos y claros para resolver:

* tenant efectivo
* si el usuario es admin
* si puede operar sobre tenant

9. Mantener compatibilidad con el comportamiento actual del tenant normal.

Qué necesito como resultado:

* cambios aplicados en archivos reales
* diff claro
* explicación breve de qué archivos cambiaste
* si encontrás lugares donde todavía queda acoplado a tenant_id obligatorio, marcarlos

No hagas una refactor grande de arquitectura.
Quiero el cambio mínimo y prolijo sobre la base actual.

