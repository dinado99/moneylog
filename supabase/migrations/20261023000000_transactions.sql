create table public.transactions (
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
  -- 중복 판별 키 (날짜|시간|타입|금액|내용)
  hash text not null,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_user_hash_idx on public.transactions (user_id, hash);

grant select, insert, update, delete on public.transactions to authenticated;

alter table public.transactions enable row level security;

create policy "본인 내역 조회" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "본인 내역 추가" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "본인 내역 수정" on public.transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "본인 내역 삭제" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);
