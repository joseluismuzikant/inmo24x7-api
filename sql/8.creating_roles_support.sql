// query para ver policies
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

// adding support for roles

alter table public.profiles
add column if not exists is_admin boolean not null default false;
alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role = any (array['owner'::text, 'manager'::text, 'agent'::text, 'viewer'::text]));
alter table public.profiles
alter column tenant_id drop not null;

alter table public.tenants
add column if not exists contact_name text,
add column if not exists contact_email text,
add column if not exists contact_phone text,
add column if not exists company_name text,
add column if not exists brand_name text,
add column if not exists address text,
add column if not exists city text,
add column if not exists province text,
add column if not exists country text default 'AR',
add column if not exists logo_url text,
add column if not exists website_url text,
add column if not exists plan_code text default 'free',
add column if not exists settings jsonb not null default '{}'::jsonb;

/// policies for leads
drop policy if exists leads_select_tenant on public.leads;
drop policy if exists leads_insert_tenant on public.leads;
drop policy if exists leads_update_tenant on public.leads;
drop policy if exists leads_delete_tenant on public.leads;

create policy leads_select_access
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

create policy leads_insert_access
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
        or (
          p.tenant_id = leads.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
      )
  )
);

create policy leads_update_access
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
        or (
          p.tenant_id = leads.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
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
        or (
          p.tenant_id = leads.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
      )
  )
);

create policy leads_delete_access
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
        or (
          p.tenant_id = leads.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
      )
  )
);


// policies for whatsapp_numbers


drop policy if exists whatsapp_numbers_select_tenant on public.whatsapp_numbers;
drop policy if exists whatsapp_numbers_write_owner_admin on public.whatsapp_numbers;

create policy whatsapp_numbers_select_access
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

create policy whatsapp_numbers_insert_access
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
        or (
          p.tenant_id = whatsapp_numbers.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
      )
  )
);

create policy whatsapp_numbers_update_access
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
        or (
          p.tenant_id = whatsapp_numbers.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
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
        or (
          p.tenant_id = whatsapp_numbers.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
      )
  )
);

create policy whatsapp_numbers_delete_access
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
        or (
          p.tenant_id = whatsapp_numbers.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
      )
  )
);


// policies for zp_postings

drop policy if exists zp_postings_select_tenant on public.zp_postings;

create policy zp_postings_select_access
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

create policy zp_postings_insert_access
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
        or (
          p.tenant_id = zp_postings.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
      )
  )
);

create policy zp_postings_update_access
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
        or (
          p.tenant_id = zp_postings.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
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
        or (
          p.tenant_id = zp_postings.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
      )
  )
);

create policy zp_postings_delete_access
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
        or (
          p.tenant_id = zp_postings.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
      )
  )
);

// policies for zp_posting_pictures

drop policy if exists zp_posting_pictures_select_tenant on public.zp_posting_pictures;

create policy zp_posting_pictures_select_access
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

create policy zp_posting_pictures_insert_access
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
        or (
          p.tenant_id = zp_posting_pictures.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
      )
  )
);

create policy zp_posting_pictures_update_access
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
        or (
          p.tenant_id = zp_posting_pictures.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
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
        or (
          p.tenant_id = zp_posting_pictures.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text, 'agent'::text])
        )
      )
  )
);

create policy zp_posting_pictures_delete_access
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
        or (
          p.tenant_id = zp_posting_pictures.tenant_id
          and p.role = any (array['owner'::text, 'manager'::text])
        )
      )
  )
);

drop policy if exists tenants_select_own on public.tenants;

create policy tenants_select_access
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

drop policy if exists tenants_select_own on public.tenants;
drop policy if exists tenants_select_access on public.tenants;

create policy tenants_select_access
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