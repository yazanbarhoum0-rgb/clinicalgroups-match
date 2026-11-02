create table if not exists public.clinical_listings (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('individual', 'group')),
  gender text not null check (gender in ('male', 'female')),
  name text check (name is null or length(trim(name)) between 1 and 80),
  members_count smallint,
  contact text not null check (length(trim(contact)) between 1 and 150),
  notes text check (notes is null or length(notes) <= 280),
  created_at timestamptz not null default now(),
  constraint clinical_listings_group_size_check check (
    (type = 'group' and members_count is not null and members_count between 2 and 11)
    or (type = 'individual' and members_count is null)
  )
);

create index if not exists clinical_listings_created_at_idx
  on public.clinical_listings (created_at desc);

alter table public.clinical_listings enable row level security;

revoke all on table public.clinical_listings from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.clinical_listings to anon, authenticated;

drop policy if exists "Anyone can view clinical listings" on public.clinical_listings;
create policy "Anyone can view clinical listings"
  on public.clinical_listings for select to anon, authenticated
  using (true);

drop policy if exists "Anyone can post a clinical listing" on public.clinical_listings;
create policy "Anyone can post a clinical listing"
  on public.clinical_listings for insert to anon, authenticated
  with check (true);

drop policy if exists "Anyone can delete a clinical listing" on public.clinical_listings;
create policy "Anyone can delete a clinical listing"
  on public.clinical_listings for delete to anon, authenticated
  using (true);
