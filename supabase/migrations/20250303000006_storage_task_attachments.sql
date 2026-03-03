-- Storage bucket for task attachments (panel only per spec)
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

create policy "Users can manage own task attachments"
  on storage.objects
  for all
  using (
    bucket_id = 'task-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'task-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
