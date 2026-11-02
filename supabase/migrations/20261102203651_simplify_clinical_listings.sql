begin;

do $$
begin
  if exists (select 1 from public.clinical_listings limit 1) then
    raise exception 'clinical_listings contains existing rows; export or remove them before applying this field-reset migration';
  end if;
end
$$;

alter table public.clinical_listings
  drop constraint if exists clinical_listings_type_check,
  drop constraint if exists clinical_listings_name_check,
  drop constraint if exists group_listing_requires_name,
  drop constraint if exists member_count_matches_listing;

alter table public.clinical_listings
  alter column name drop not null,
  drop column if exists year,
  drop column if exists rotation,
  drop column if exists hospital,
  drop column if exists group_name,
  drop column if exists members_needed,
  add column if not exists members_count smallint;

alter table public.clinical_listings rename column note to notes;

alter table public.clinical_listings
  add constraint clinical_listings_type_check
    check (type in ('individual', 'group')),
  add constraint clinical_listings_name_check
    check (name is null or length(trim(name)) between 1 and 80),
  add constraint clinical_listings_group_size_check
    check (
      (type = 'group' and members_count is not null and members_count between 2 and 11)
      or (type = 'individual' and members_count is null)
    );

commit;
