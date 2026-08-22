-- Create connection_requests table
create table if not exists connection_requests (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references profiles(id) on delete cascade not null,
  doctor_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Ensure unique pair of patient and doctor
  unique(patient_id, doctor_id)
);

-- Enable Row Level Security
alter table connection_requests enable row level security;

-- Policies
-- Patients can view their own requests
create policy "Patients can view their own requests"
  on connection_requests for select
  using (auth.uid() = patient_id);

-- Doctors can view requests sent to them
create policy "Doctors can view requests sent to them"
  on connection_requests for select
  using (auth.uid() = doctor_id);

-- Patients can insert requests
create policy "Patients can cancel/create requests"
  on connection_requests for insert
  with check (auth.uid() = patient_id);

-- Doctors can update status (accept/reject)
create policy "Doctors can update status"
  on connection_requests for update
  using (auth.uid() = doctor_id);
