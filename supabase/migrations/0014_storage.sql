-- Storage diet (2026-09-23). The database hit 739 MB against the free plan's 500 MB; jobs was 722 MB of it.
-- 1. description_html is never rendered (the app reads description_text). Stop keeping it.
-- 2. Jobs Rails will never show (pre-tagged or triaged out, field "other") keep title, company, url, but no description.
-- 3. Closed jobs lose their description after 30 days; tracker rows keep title/company/url.
-- Run the updates, then VACUUM FULL public.jobs on its own (it cannot run inside a transaction) to return the space.
update public.jobs set description_html = null where description_html is not null;
update public.jobs set description_text = '' where source = 'feed' and tagged_at is not null and coalesce(tags->>'field', 'other') = 'other' and description_text <> '';
update public.jobs set description_text = '' where closed_at < now() - interval '30 days' and description_text <> '';

-- Keep it that way: a weekly sweep for closed jobs.
select cron.schedule('rails-jobs-sweep', '15 7 * * 0', $$update public.jobs set description_text = '', description_html = null where closed_at < now() - interval '30 days' and (description_text <> '' or description_html is not null)$$);
