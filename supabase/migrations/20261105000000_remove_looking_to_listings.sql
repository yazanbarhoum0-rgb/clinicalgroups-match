begin;

-- Remove listings created for the retired “Looking for” feature.
delete from public.clinical_listings where type = 'looking_to';

alter table public.clinical_listings
  drop constraint if exists clinical_listings_type_check,
  drop constraint if exists clinical_listings_gender_check,
  drop constraint if exists clinical_listings_group_size_check,
  drop constraint if exists clinical_listings_looking_for_check,
  drop column if exists looking_for;

alter table public.clinical_listings
  add constraint clinical_listings_type_check
    check (type in ('individual', 'group')),
  add constraint clinical_listings_gender_check
    check (gender in ('male', 'female')),
  add constraint clinical_listings_group_size_check check (
    (type = 'group' and members_count is not null and members_count between 2 and 11)
    or (type = 'individual' and members_count is null)
  );

commit;
