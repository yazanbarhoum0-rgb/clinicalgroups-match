begin;

alter table public.clinical_listings
  drop constraint if exists clinical_listings_type_check,
  drop constraint if exists clinical_listings_group_size_check;

alter table public.clinical_listings
  add constraint clinical_listings_type_check
    check (type in ('individual', 'group', 'looking_to')),
  add constraint clinical_listings_group_size_check check (
    (type = 'group' and members_count is not null and members_count between 2 and 11)
    or (type in ('individual', 'looking_to') and members_count is null)
  );

commit;
