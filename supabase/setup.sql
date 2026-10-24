-- 처음 설정하거나 일부만 실행했을 때 한 번에 돌리는 전체 스키마 (여러 번 실행해도 안전)

-- 거래 내역
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  time text check (time ~ '^\d{2}:\d{2}$'),
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount bigint not null check (amount > 0),
  category text not null,
  subcategory text,
  merchant text not null,
  method text,
  memo text,
  source text not null check (source in ('manual', 'excel', 'image')),
  hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_user_hash_idx on public.transactions (user_id, hash);

-- 지출/수입 분류 (parent_id가 null이면 대분류)
create table if not exists public.categories (
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
create index if not exists categories_user_idx on public.categories (user_id, type, sort);

-- 자산 그룹 / 자산
create table if not exists public.asset_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id uuid not null references public.asset_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  aliases text[] not null default '{}',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.assets add column if not exists balance bigint;
alter table public.assets add column if not exists balance_updated_at timestamptz;
create index if not exists assets_user_idx on public.assets (user_id, group_id, sort);

-- 권한 + RLS (본인 데이터만)
grant select, insert, update, delete on public.transactions, public.categories, public.asset_groups, public.assets to authenticated;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.asset_groups enable row level security;
alter table public.assets enable row level security;

drop policy if exists "본인 내역 조회" on public.transactions;
drop policy if exists "본인 내역 추가" on public.transactions;
drop policy if exists "본인 내역 수정" on public.transactions;
drop policy if exists "본인 내역 삭제" on public.transactions;
drop policy if exists "본인 내역" on public.transactions;
create policy "본인 내역" on public.transactions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "본인 분류" on public.categories;
create policy "본인 분류" on public.categories
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "본인 자산 그룹" on public.asset_groups;
create policy "본인 자산 그룹" on public.asset_groups
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "본인 자산" on public.assets;
create policy "본인 자산" on public.assets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
