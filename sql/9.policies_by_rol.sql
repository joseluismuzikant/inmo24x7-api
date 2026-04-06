begin;

-- =========================================================
-- ENABLE RLS
-- =========================================================
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.whatsapp_numbers enable row level security;
alter table public.zp_postings enable row level security;
alter table public.zp_posting_pictures enable row level security;
alter table public.tenant_channels enable row level security;
alter table public.tenant_plans enable row level security;
alter table public.audit_log enable row level security;

-- =========================================================
-- DROP EXISTING POLICIES
-- =========================================================

-- leads
drop policy if exists "leads_select_access" on public.leads;
drop policy if exists "leads_insert_access" on public.leads;
drop policy if exists "leads_update_access" on public.leads;
drop policy if exists "leads_delete_access" on public.leads;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- tenants
drop policy if exists "tenants_select_access" on public.tenants;

-- whatsapp_numbers
drop policy if exists "whatsapp_numbers_select_access" on public.whatsapp_numbers;
drop policy if exists "whatsapp_numbers_insert_access" on public.whatsapp_numbers;
drop policy if exists "whatsapp_numbers_update_access" on public.whatsapp_numbers;
drop policy if exists "whatsapp_numbers_delete_access" on public.whatsapp_numbers;

-- zp_postings
drop policy if exists "zp_postings_select_access" on public.zp_postings;
drop policy if exists "zp_postings_insert_access" on public.zp_postings;
drop policy if exists "zp_postings_update_access" on public.zp_postings;
drop policy if exists "zp_postings_delete_access" on public.zp_postings;

-- zp_posting_pictures
drop policy if exists "zp_posting_pictures_select_access" on public.zp_posting_pictures;
drop policy if exists "zp_posting_pictures_insert_access" on public.zp_posting_pictures;
drop policy if exists "zp_posting_pictures_update_access" on public.zp_posting_pictures;
drop policy if exists "zp_posting_pictures_delete_access" on public.zp_posting_pictures;

-- por si existen de pruebas anteriores
drop policy if exists "tenants_select" on public.tenants;
drop policy if exists "tenants_update" on public.tenants;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;

drop policy if exists "tenant_channels_select" on public.tenant_channels;
drop policy if exists "tenant_channels_insert" on public.tenant_channels;
drop policy if exists "tenant_channels_update" on public.tenant_channels;
drop policy if exists "tenant_channels_delete" on public.tenant_channels;

drop policy if exists "tenant_plans_select" on public.tenant_plans;
drop policy if exists "tenant_plans_insert" on public.tenant_plans;
drop policy if exists "tenant_plans_update" on public.tenant_plans;
drop policy if exists "tenant_plans_delete" on public.tenant_plans;

drop policy if exists "audit_log_select_admin_only" on public.audit_log;
drop policy if exists "audit_log_insert_admin_only" on public.audit_log;
drop policy if exists "audit_log_update_admin_only" on public.audit_log;
drop policy if exists "audit_log_delete_admin_only" on public.audit_log;

-- =========================================================
-- TENANTS
-- =========================================================
create policy "tenants_select"
on public.tenants
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = tenants.id
      )
  )
);

create policy "tenants_update"
on public.tenants
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenants.id and p.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenants.id and p.role in ('owner', 'manager'))
      )
  )
);

-- =========================================================
-- PROFILES
-- admin ve y edita todo
-- usuario normal ve y edita su propio profile
-- =========================================================
create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

-- =========================================================
-- LEADS
-- viewer: select
-- agent/manager/owner: insert/update
-- manager/owner: delete
-- admin: todo
-- =========================================================
create policy "leads_select_access"
on public.leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = leads.tenant_id
      )
  )
);

create policy "leads_insert_access"
on public.leads
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = leads.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "leads_update_access"
on public.leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = leads.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = leads.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "leads_delete_access"
on public.leads
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = leads.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

-- =========================================================
-- WHATSAPP NUMBERS
-- viewer: select
-- agent/manager/owner: insert/update
-- manager/owner: delete
-- admin: todo
-- =========================================================
create policy "whatsapp_numbers_select_access"
on public.whatsapp_numbers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = whatsapp_numbers.tenant_id
      )
  )
);

create policy "whatsapp_numbers_insert_access"
on public.whatsapp_numbers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = whatsapp_numbers.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "whatsapp_numbers_update_access"
on public.whatsapp_numbers
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = whatsapp_numbers.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = whatsapp_numbers.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "whatsapp_numbers_delete_access"
on public.whatsapp_numbers
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = whatsapp_numbers.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

-- =========================================================
-- TENANT CHANNELS
-- viewer: select
-- owner/manager: insert/update/delete
-- admin: todo
-- =========================================================
create policy "tenant_channels_select"
on public.tenant_channels
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = tenant_channels.tenant_id
      )
  )
);

create policy "tenant_channels_insert"
on public.tenant_channels
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenant_channels.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

create policy "tenant_channels_update"
on public.tenant_channels
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenant_channels.tenant_id and p.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenant_channels.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

create policy "tenant_channels_delete"
on public.tenant_channels
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenant_channels.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

-- =========================================================
-- TENANT PLANS
-- como tiene tenant_id, lo tratamos tenant-scoped
-- viewer: select
-- owner/manager: update
-- admin: todo
-- =========================================================
create policy "tenant_plans_select"
on public.tenant_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = tenant_plans.tenant_id
      )
  )
);

create policy "tenant_plans_insert"
on public.tenant_plans
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

create policy "tenant_plans_update"
on public.tenant_plans
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenant_plans.tenant_id and p.role in ('owner', 'manager'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = tenant_plans.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

create policy "tenant_plans_delete"
on public.tenant_plans
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

-- =========================================================
-- ZP POSTINGS
-- viewer: select
-- agent/manager/owner: insert/update
-- manager/owner: delete
-- admin: todo
-- =========================================================
create policy "zp_postings_select_access"
on public.zp_postings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = zp_postings.tenant_id
      )
  )
);

create policy "zp_postings_insert_access"
on public.zp_postings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_postings.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "zp_postings_update_access"
on public.zp_postings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_postings.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_postings.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "zp_postings_delete_access"
on public.zp_postings
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_postings.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

-- =========================================================
-- ZP POSTING PICTURES
-- usa tenant_id propio, así que queda simple y consistente
-- =========================================================
create policy "zp_posting_pictures_select_access"
on public.zp_posting_pictures
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or p.tenant_id = zp_posting_pictures.tenant_id
      )
  )
);

create policy "zp_posting_pictures_insert_access"
on public.zp_posting_pictures
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_posting_pictures.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "zp_posting_pictures_update_access"
on public.zp_posting_pictures
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_posting_pictures.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_posting_pictures.tenant_id and p.role in ('owner', 'manager', 'agent'))
      )
  )
);

create policy "zp_posting_pictures_delete_access"
on public.zp_posting_pictures
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and (
        p.is_admin = true
        or (p.tenant_id = zp_posting_pictures.tenant_id and p.role in ('owner', 'manager'))
      )
  )
);

-- =========================================================
-- AUDIT LOG
-- frontend solo admin
-- backend con service role sigue pudiendo todo
-- =========================================================
create policy "audit_log_select_admin_only"
on public.audit_log
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

create policy "audit_log_insert_admin_only"
on public.audit_log
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

create policy "audit_log_update_admin_only"
on public.audit_log
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

create policy "audit_log_delete_admin_only"
on public.audit_log
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_admin = true
  )
);

commit;