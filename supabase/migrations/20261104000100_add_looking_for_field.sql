begin;

alter table public.clinical_listings
  add column if not exists looking_for text;

update public.clinical_listings
set looking_for = nullif(trim(notes), '')
where type = 'looking_to' and looking_for is null;

alter table public.clinical_listings
  drop constraint if exists clinical_listings_looking_for_check;

alter table public.clinical_listings
  add constraint clinical_listings_looking_for_check check (
    (type = 'looking_to' and looking_for is not null and length(trim(looking_for)) between 1 and 280)
    or (type <> 'looking_to' and looking_for is null)
  );

commit;
