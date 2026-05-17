-- Academic data tables for cloud shadow sync (localStorage remains source of truth).
-- Idempotent: safe if 001_initial_schema.sql already created these objects.

create extension if not exists "pgcrypto";

-- Terms: owned by auth user
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  target_gpa numeric(4, 2),
  created_at timestamptz not null default now()
);

-- Courses: belong to a term
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete cascade,
  name text not null,
  credits numeric(5, 2) not null default 0.5,
  target_letter text,
  target_gpa numeric(4, 2),
  created_at timestamptz not null default now()
);

-- Assignments: belong to a course
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  weight numeric(5, 2) not null,
  earned_points numeric(10, 2),
  total_points numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists terms_user_id_idx on public.terms (user_id);
create index if not exists courses_term_id_idx on public.courses (term_id);
create index if not exists assignments_course_id_idx on public.assignments (course_id);

-- Prefer auth.users for terms (001 may reference public.users)
alter table public.terms drop constraint if exists terms_user_id_fkey;

alter table public.terms
  add constraint terms_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.terms enable row level security;
alter table public.courses enable row level security;
alter table public.assignments enable row level security;

drop policy if exists "terms_all_own" on public.terms;
create policy "terms_all_own" on public.terms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "courses_all_own" on public.courses;
create policy "courses_all_own" on public.courses
  for all using (
    exists (
      select 1 from public.terms t
      where t.id = term_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.terms t
      where t.id = term_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "assignments_all_own" on public.assignments;
create policy "assignments_all_own" on public.assignments
  for all using (
    exists (
      select 1 from public.courses c
      join public.terms t on t.id = c.term_id
      where c.id = course_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.courses c
      join public.terms t on t.id = c.term_id
      where c.id = course_id and t.user_id = auth.uid()
    )
  );
