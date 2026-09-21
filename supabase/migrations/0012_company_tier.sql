-- Company tier: 1 = marquee (FAANG, top quant/trading, hot startups: the names students ask for first), 2 = well known, 3 = everyone else.
-- Used as a tie-break inside a fit band and by the "Top companies" filter. Never changes a fit score.
alter table public.companies add column if not exists tier int not null default 3;
create index if not exists companies_tier on public.companies (tier);
