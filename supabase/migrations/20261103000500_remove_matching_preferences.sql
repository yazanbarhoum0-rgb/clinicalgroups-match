begin;

alter table public.clinical_listings
  drop constraint if exists clinical_listings_matching_preference_check,
  drop constraint if exists clinical_listings_preference_note_check,
  drop column if exists matching_preference,
  drop column if exists preference_note;

commit;
