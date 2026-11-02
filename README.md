# Clinical Match · BAU Medical Community

A minimal one-page matching board. Students register as an individual or a group; groups list their member count. Listings include gender and are filtered by type, gender, and group size.

## Supabase setup

This project is already connected through `.env.local`. For a new Supabase project, run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. For the existing project, run any unapplied files in `supabase/migrations/` in timestamp order. The simplification migration checks that the old table is empty before dropping fields.

The app uses a publishable key in the browser. Never place a Supabase secret key or service role key in a `NEXT_PUBLIC_` variable. Listings and contact methods are public to anyone with access to the app; sign-in can be added before a wider launch.

## Cloudflare Workers deployment

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Cloudflare build environment before building and deploying. Next.js inlines `NEXT_PUBLIC_` variables into browser JavaScript at build time, so setting them only as Worker runtime variables or changing them after a build will not update the deployed Supabase client. Redeploy after changing either value. Use the Supabase project URL and publishable key; never use a secret or service-role key here. See [`.env.example`](.env.example) for the required variable names.
