-- Private bucket for uploaded resumes; path = <user_id>/base-<ts>.<pdf|docx>. Applied 2026-09-20.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes','resumes', false, 5242880, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
create policy "own resume files read" on storage.objects for select using (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
