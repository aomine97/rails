-- Company profile fields: domain drives the logo; size/industry/hq are filled by scripts/enrich-companies.mjs over time.
alter table public.companies
  add column if not exists domain text,
  add column if not exists logo_url text,
  add column if not exists size text,        -- '1-50' | '51-200' | '201-1000' | '1001-5000' | '5000+'
  add column if not exists industry text,
  add column if not exists hq text;
