begin;

grant delete on table public.clinical_listings to anon, authenticated;

drop policy if exists "Anyone can delete a clinical listing" on public.clinical_listings;
create policy "Anyone can delete a clinical listing"
  on public.clinical_listings for delete to anon, authenticated
  using (true);

commit;
