-- 지출/수입 분류 (parent_id가 null이면 대분류, 아니면 소분류)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  parent_id uuid references public.categories (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, type, parent_id, name)
);

create index categories_user_idx on public.categories (user_id, type, sort);

-- 자산 그룹 (현금·예금, 신용카드 ...)
create table public.asset_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 자산 (계좌, 카드 ...). aliases: 가져오기에서 같은 자산으로 볼 다른 이름들
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null references public.asset_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  aliases text[] not null default '{}',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index assets_user_idx on public.assets (user_id, group_id, sort);

grant select, insert, update, delete on public.categories, public.asset_groups, public.assets to authenticated;

alter table public.categories enable row level security;
alter table public.asset_groups enable row level security;
alter table public.assets enable row level security;

create policy "본인 분류" on public.categories
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "본인 자산 그룹" on public.asset_groups
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "본인 자산" on public.assets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
