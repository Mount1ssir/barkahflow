create table if not exists public.pin_reset_temp (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pin_hash text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_pin_reset_temp_user on public.pin_reset_temp(user_id);

-- Active RLS : personne ne peut lire/écrire directement cette table
-- sauf via les Edge Functions (qui utilisent la service_role key, laquelle bypasse RLS)
alter table public.pin_reset_temp enable row level security;