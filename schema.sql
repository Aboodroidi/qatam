-- ============================================================
--  قاعدة بيانات حسابات المزرعة — Qatam Farm
--  Run this ONCE in Supabase → SQL Editor → New query → Run.
-- ============================================================

-- 1) جدول الفواتير / الإيصالات
create table if not exists public.receipts (
  id           uuid primary key default gen_random_uuid(),
  partner      text        not null,          -- abo_abdulrahman | abo_abdullah
  amount       numeric(12,2) not null check (amount >= 0),
  category     text        not null,
  receipt_date date        not null default current_date,
  note         text,
  photo_url    text,
  photo_path   text,
  created_at   timestamptz not null default now()
);

create index if not exists receipts_created_at_idx on public.receipts (created_at desc);

-- 2) تفعيل المزامنة اللحظية (Realtime) لهذا الجدول
alter publication supabase_realtime add table public.receipts;

-- 3) صلاحيات الوصول (Row Level Security)
--    ملاحظة: هذا يسمح لأي شخص لديه رابط التطبيق والمفتاح العام
--    بالقراءة والإضافة والحذف. مناسب لأداة خاصة بين شريكين.
alter table public.receipts enable row level security;

drop policy if exists "read receipts"   on public.receipts;
drop policy if exists "insert receipts" on public.receipts;
drop policy if exists "delete receipts" on public.receipts;

create policy "read receipts"   on public.receipts for select using (true);
create policy "insert receipts" on public.receipts for insert with check (true);
create policy "delete receipts" on public.receipts for delete using (true);

-- ============================================================
--  4) تخزين صور الإيصالات
--     أنشئ Bucket عام باسم "receipts":
--     Supabase → Storage → New bucket → Name: receipts → Public ✓
--
--     ثم شغّل سياسات التخزين التالية:
-- ============================================================
drop policy if exists "public read receipts bucket"   on storage.objects;
drop policy if exists "public upload receipts bucket"  on storage.objects;
drop policy if exists "public delete receipts bucket"  on storage.objects;

create policy "public read receipts bucket"
  on storage.objects for select
  using (bucket_id = 'receipts');

create policy "public upload receipts bucket"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

create policy "public delete receipts bucket"
  on storage.objects for delete
  using (bucket_id = 'receipts');
