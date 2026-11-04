begin;

alter table public.clinical_listings
  drop constraint if exists clinical_listings_gender_check;

alter table public.clinical_listings
  add constraint clinical_listings_gender_check check (
    (type = 'looking_to' and gender in ('male', 'female', 'both'))
    or (type in ('individual', 'group') and gender in ('male', 'female'))
  );

commit;
