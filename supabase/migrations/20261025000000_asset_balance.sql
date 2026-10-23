-- 자산 잔액 (뱅크샐러드 자산 현황 가져오기 / 직접 입력)
alter table public.assets add column balance bigint;
alter table public.assets add column balance_updated_at timestamptz;
