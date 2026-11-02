begin;

alter table public.clinical_listings
  add column if not exists gender text;

do $$
begin
  if exists (
    select 1 from public.clinical_listings where gender = 'mixed' limit 1
  ) then
    raise exception 'clinical_listings contains mixed-gender entries; update them before restricting gender to male or female';
  end if;
end
$$;

alter table public.clinical_listings
  alter column gender set not null,
  drop constraint if exists clinical_listings_gender_check;

alter table public.clinical_listings
  add constraint clinical_listings_gender_check
  check (gender in ('male', 'female'));

grant delete on table public.clinical_listings to anon, authenticated;

drop policy if exists "Anyone can delete a clinical listing" on public.clinical_listings;
create policy "Anyone can delete a clinical listing"
  on public.clinical_listings for delete to anon, authenticated
  using (true);

commit;
