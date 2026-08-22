-- Create a new storage bucket for verification documents
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket
create policy "Authenticated users can upload verification docs"
  on storage.objects for insert
  with check ( bucket_id = 'verification-docs' and auth.role() = 'authenticated' );

create policy "Users can view verification docs"
  on storage.objects for select
  using ( bucket_id = 'verification-docs' );
