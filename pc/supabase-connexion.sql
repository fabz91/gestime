-- GESTIME (v49) : réserver la table au SEUL compte GESTIME (identifiant G20 = g20@example.com).
-- À lancer UNE fois dans Supabase > SQL Editor > New query > Run,
-- SEULEMENT quand tous les PC et l'iPhone sont connectés (Réglages > Compte : « Connecté : G20 »).
-- Après ça, un poste non connecté (ou connecté avec un autre compte) ne peut plus lire ni écrire les données GESTIME.
-- (GESMAR et GESCOUNT ne sont pas touchés.)
revoke all on public.store from anon;
drop policy if exists "lecture_ouverte" on public.store;
drop policy if exists "ecriture_ouverte" on public.store;
drop policy if exists "lecture_connecte" on public.store;
drop policy if exists "ecriture_connecte" on public.store;
create policy "lecture_connecte" on public.store for select to authenticated
  using (lower(auth.jwt()->>'email') = 'g20@example.com');
create policy "ecriture_connecte" on public.store for update to authenticated
  using (lower(auth.jwt()->>'email') = 'g20@example.com')
  with check (lower(auth.jwt()->>'email') = 'g20@example.com');
grant select, update on public.store to authenticated;
