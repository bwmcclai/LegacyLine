-- =============================================
-- Legacy Line — Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Recordings table
create table if not exists recordings (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  audio_url text not null,
  selfie_url text,
  duration integer,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table recordings enable row level security;

-- Drop existing policies to ensure clean update
drop policy if exists "Anyone can read recordings" on recordings;
drop policy if exists "Anyone can insert recordings" on recordings;

-- Allow anyone to read recordings (public display page)
create policy "Anyone can read recordings"
  on recordings for select
  to anon, authenticated
  using (true);

-- Allow anyone to insert recordings (from NFC scan)
create policy "Anyone can insert recordings"
  on recordings for insert
  to anon, authenticated
  with check (true);

-- =============================================
-- Storage Buckets & Policies
-- Run these in the Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Create buckets if they don't exist
insert into storage.buckets (id, name, public)
values ('legacy-audio', 'legacy-audio', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('legacy-selfies', 'legacy-selfies', true)
on conflict (id) do nothing;

-- Drop existing storage policies to ensure clean update
drop policy if exists "Allow public to upload audio" on storage.objects;
drop policy if exists "Allow public to read audio" on storage.objects;
drop policy if exists "Allow public to upload selfies" on storage.objects;
drop policy if exists "Allow public to read selfies" on storage.objects;

-- 2. Storage Policies for legacy-audio
create policy "Allow public to upload audio"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'legacy-audio');

create policy "Allow public to read audio"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'legacy-audio');

-- 3. Storage Policies for legacy-selfies
create policy "Allow public to upload selfies"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'legacy-selfies');

create policy "Allow public to read selfies"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'legacy-selfies');

-- =============================================
-- Quick verification query
-- =============================================
select count(*) from recordings;
