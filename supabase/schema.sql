-- Общая Грядка — таблица игроков
-- Выполнить в Supabase: SQL Editor → вставить → Run

create table if not exists players (
  id         text primary key,
  name       text,
  coins      int default 0,
  state      jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- MVP: открытые права (топ видят все, каждый пишет свою строку)
alter table players enable row level security;

drop policy if exists "players read" on players;
create policy "players read" on players
  for select using (true);

drop policy if exists "players write" on players;
create policy "players write" on players
  for insert with check (true);

drop policy if exists "players update" on players;
create policy "players update" on players
  for update using (true) with check (true);
