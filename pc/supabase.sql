-- À coller dans Supabase > SQL Editor > New query > Run
-- Version SANS connexion : le logiciel lit et écrit directement, sans mot de passe.
create table if not exists public.store (
  id int primary key,
  data jsonb not null default '{}'::jsonb,
  rev int not null default 0,
  updated_at timestamptz default now()
);
insert into public.store (id) values (1) on conflict (id) do nothing;
insert into public.store (id) values (2) on conflict (id) do nothing; -- CLAMART

alter table public.store enable row level security;
drop policy if exists "lecture" on public.store;
drop policy if exists "ecriture" on public.store;
drop policy if exists "lecture_ouverte" on public.store;
drop policy if exists "ecriture_ouverte" on public.store;
create policy "lecture_ouverte" on public.store for select to anon, authenticated using (true);
create policy "ecriture_ouverte" on public.store for update to anon, authenticated using (true) with check (true);
