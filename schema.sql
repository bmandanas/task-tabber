-- Run this once in your Supabase SQL editor

create table categories (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid default auth.uid() references auth.users not null,
  name        text not null,
  color       text not null,
  created_at  timestamptz default now()
);

create table tasks (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid default auth.uid() references auth.users not null,
  category_id  uuid references categories(id) on delete cascade not null,
  title        text not null,
  points       integer not null default 1,
  completed    boolean not null default false,
  completed_at timestamptz,
  dates_worked text[] not null default '{}',
  created_at   timestamptz default now()
);

alter table categories enable row level security;
alter table tasks       enable row level security;

create policy "own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on categories (user_id);
create index on tasks (user_id);
create index on tasks (category_id);
