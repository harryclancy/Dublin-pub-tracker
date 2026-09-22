-- Dublin Pub Tracker — shared database setup.
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run twice.

-- 1. One generic table holds every synced record (statuses, reviews, visits,
--    drinks, photo metadata, pub edits, crawls, custom pubs, guest reviews).
--    A single table keeps the client simple and means app-side shape changes
--    never need a database migration.
create table if not exists public.records (
  collection  text        not null,
  id          text        not null,
  data        jsonb,
  deleted     boolean     not null default false,
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

-- The sync cursor pages through this, so it needs to be quick to scan.
create index if not exists records_updated_at_idx on public.records (updated_at);

-- 2. updated_at is stamped by the server, never by a phone — two devices with
--    slightly different clocks must still agree on what happened last.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists records_set_updated_at on public.records;
create trigger records_set_updated_at
  before insert or update on public.records
  for each row execute function public.set_updated_at();

-- 3. Row level security: the public anon key alone can't read or write
--    anything. Only a signed-in session (i.e. someone who entered the shared
--    passphrase) gets access.
alter table public.records enable row level security;

drop policy if exists "shared access" on public.records;
create policy "shared access" on public.records
  for all to authenticated using (true) with check (true);

-- 4. Realtime, so one phone's change lands on the other's screen immediately
--    rather than waiting for the next poll.
do $$
begin
  alter publication supabase_realtime add table public.records;
exception
  when duplicate_object then null;  -- already added on a previous run
end $$;

-- 5. Private bucket for pint photos (the image bytes; their metadata rides in
--    the records table above).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "shared photo access" on storage.objects;
create policy "shared photo access" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos') with check (bucket_id = 'photos');
