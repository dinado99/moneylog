-- 머니로그 전체 스키마. 다른 프로젝트와 같은 Supabase를 쓰므로 모든 테이블에 moneylog_ 접두어.
-- 여러 번 실행해도 안전.

-- 가계부 기록 (구글 시트 '가계부 기록' 한 줄 = 한 행)
create table if not exists public.moneylog_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('수입', '지출', '이동')),
  category text,
  subcategory text,
  content text not null default '',
  amount bigint not null check (amount > 0),
  in_account text,
  out_account text,
  source text not null default 'app' check (source in ('app', 'sheet', 'import')),
  -- 시트에 반영된 마지막 값(정규화한 한 줄). 시트에서 같은 줄을 찾을 때 쓴다. 아직 시트에 없으면 null
  sheet_key text,
  -- false면 시트에 아직 반영 안 된 변경이 있음 (deleted와 함께면 시트에서 지워야 함)
  synced boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists moneylog_records_user_date_idx on public.moneylog_records (user_id, date desc);

-- 시트 '가계부 설정'에서 읽어 온 분류 (자산·부채·수입·지출). subs = [{"name": "...", "fixed": true}]
create table if not exists public.moneylog_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('자산', '부채', '수입', '지출')),
  name text not null,
  fixed boolean not null default false,
  subs jsonb not null default '[]',
  sort integer not null default 0
);

-- 시트 '가계부 설정'의 계좌/자산 목록
create table if not exists public.moneylog_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('자산', '부채')),
  category text not null,
  subcategory text,
  name text not null,
  start_amount bigint not null default 0,
  memo text,
  hidden boolean not null default false,
  sort integer not null default 0
);

-- 시트 '수입·지출 달력'의 정기 일정 (월급날, 카드 결제일 ...)
create table if not exists public.moneylog_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  day integer not null check (day between 1 and 31),
  weekend text check (weekend in ('당기기', '밀기')),
  sort integer not null default 0
);

-- 사용자별 설정: 구글 시트 연결 정보, 시작 년도, 회계기준월, 마지막 동기화
create table if not exists public.moneylog_config (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sheet_url text,
  sheet_token text,
  start_year integer,
  fiscal_month integer not null default 1,
  last_sync timestamptz
);

-- 뱅크샐러드 가져오기 규칙: 분류 변환, 가맹점 → 분류 (시트에는 없는 정보)
create table if not exists public.moneylog_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_type text not null check (match_type in ('category', 'merchant')),
  -- category: "뱅크샐러드대분류" 또는 "뱅크샐러드대분류>소분류", merchant: 가맹점 이름에 포함된 글자
  source text not null,
  kind text not null check (kind in ('수입', '지출', '이동')),
  category text,
  subcategory text,
  created_at timestamptz not null default now(),
  unique (user_id, match_type, source)
);

-- 뱅크샐러드 결제수단 이름 → 시트 계좌 이름
create table if not exists public.moneylog_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alias text not null,
  account text not null,
  unique (user_id, alias)
);

grant select, insert, update, delete on
  public.moneylog_records, public.moneylog_categories, public.moneylog_accounts, public.moneylog_schedules,
  public.moneylog_config, public.moneylog_rules, public.moneylog_aliases
to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['moneylog_records', 'moneylog_categories', 'moneylog_accounts', 'moneylog_schedules',
                           'moneylog_config', 'moneylog_rules', 'moneylog_aliases'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "moneylog 본인 데이터" on public.%I', t);
    execute format(
      'create policy "moneylog 본인 데이터" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
