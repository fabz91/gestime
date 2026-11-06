-- GESTIME (v46) : réserver la table aux comptes connectés.
-- À lancer UNE fois dans Supabase > SQL Editor > New query > Run,
-- SEULEMENT quand tous les PC sont connectés (Réglages > Compte : « Connecté : … »).
-- Après ça, un poste non connecté ne peut plus lire ni écrire les données GESTIME.
-- (GESMAR et GESCOUNT ne sont pas touchés.)
revoke all on public.store from anon;
drop policy if exists "lecture_ouverte" on public.store;
drop policy if exists "ecriture_ouverte" on public.store;
drop policy if exists "lecture_connecte" on public.store;
drop policy if exists "ecriture_connecte" on public.store;
create policy "lecture_connecte" on public.store for select to authenticated using (true);
create policy "ecriture_connecte" on public.store for update to authenticated using (true) with check (true);
