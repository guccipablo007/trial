-- camsu-connect schema and RLS

create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type user_role as enum ('system_admin','secretary','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('pending','active','disabled');
exception when duplicate_object then null; end $$;

-- Helper functions
create or replace function is_active() returns boolean language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.status = 'active');
$$;

create or replace function is_admin() returns boolean language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'system_admin' and p.status = 'active');
$$;

create or replace function is_secretary() returns boolean language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'secretary' and p.status = 'active');
$$;

-- Profiles
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  avatar_url text,
  email text,
  role user_role not null default 'member',
  status user_status not null default 'pending',
  created_at timestamp with time zone default now()
);

-- Trigger to insert profile on signup
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, address, email, status)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'phone',''),
          coalesce(new.raw_user_meta_data->>'address',''),
          new.email,
          'pending');

  -- notify all active admins of new signup
  insert into public.notifications (user_id, type, payload)
  select p.id, 'new_signup', jsonb_build_object('user_id', new.id, 'full_name', coalesce(new.raw_user_meta_data->>'full_name',''))
  from public.profiles p where p.role = 'system_admin' and p.status = 'active';

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure handle_new_user();

-- Announcements
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- Projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null check (status in ('ongoing','completed')) default 'ongoing',
  budget numeric(12,2),
  start_date date
);

create table if not exists project_disbursements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  reason text
);

create table if not exists project_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid references profiles(id),
  amount numeric(12,2) not null,
  date date not null
);

-- Finance: loans and fines
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  principal numeric(12,2) not null,
  interest_rate numeric(5,2) not null default 0.5,
  status text not null default 'active',
  issued_at timestamp with time zone default now(),
  due_date date,
  reason text
);

create table if not exists loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamp with time zone default now()
);

create table if not exists fines (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  issued_at timestamp with time zone default now(),
  due_date date,
  reason text,
  status text not null default 'unpaid'
);

create table if not exists fine_payments (
  id uuid primary key default gen_random_uuid(),
  fine_id uuid not null references fines(id) on delete cascade,
  amount numeric(12,2) not null,
  paid_at timestamp with time zone default now()
);

-- Meetings & minutes
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamp with time zone not null,
  location text
);

create table if not exists minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  content text not null,
  recorded_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- Notifications & audit
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles(id),
  action text not null,
  target uuid,
  meta jsonb,
  created_at timestamp with time zone default now()
);

-- RLS
alter table profiles enable row level security;
alter table announcements enable row level security;
alter table projects enable row level security;
alter table project_disbursements enable row level security;
alter table project_contributions enable row level security;
alter table loans enable row level security;
alter table loan_payments enable row level security;
alter table fines enable row level security;
alter table fine_payments enable row level security;
alter table meetings enable row level security;
alter table minutes enable row level security;
alter table notifications enable row level security;
alter table admin_actions enable row level security;

-- Attendance tracking
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  status text not null check (status in ('present','absent','on_leave')),
  meeting_id uuid references meetings(id),
  created_at timestamp with time zone default now(),
  unique (member_id, day)
);
alter table attendance enable row level security;

drop policy if exists attendance_select on attendance;
create policy attendance_select on attendance for select using (is_active());

drop policy if exists attendance_modify on attendance;
create policy attendance_modify on attendance for all using (is_admin() or is_secretary()) with check (is_admin() or is_secretary());

-- Profiles policies
drop policy if exists profiles_select_all on profiles;
create policy profiles_select_all on profiles
  for select using (
    -- allow active users to read active profiles; allow each user to read self
    (exists (select 1 from profiles me where me.id = auth.uid() and me.status = 'active') and status = 'active')
    or id = auth.uid()
  );

drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin on profiles
  for update using (is_admin());

-- Announcements policies
drop policy if exists ann_select on announcements;
create policy ann_select on announcements for select using (is_active());

drop policy if exists ann_modify on announcements;
create policy ann_modify on announcements for all using (is_admin() or is_secretary());

-- Projects policies
drop policy if exists proj_select on projects;
create policy proj_select on projects for select using (is_active());

drop policy if exists proj_modify on projects;
create policy proj_modify on projects for all using (is_admin() or is_secretary());

drop policy if exists proj_disb_select on project_disbursements;
create policy proj_disb_select on project_disbursements for select using (is_active());

drop policy if exists proj_disb_modify on project_disbursements;
create policy proj_disb_modify on project_disbursements for all using (is_admin() or is_secretary());

drop policy if exists proj_contrib_select on project_contributions;
create policy proj_contrib_select on project_contributions for select using (is_active());

drop policy if exists proj_contrib_modify on project_contributions;
create policy proj_contrib_modify on project_contributions for all using (is_admin() or is_secretary());

-- Finance policies
drop policy if exists loans_select on loans;
create policy loans_select on loans for select using (is_active());

drop policy if exists loans_modify on loans;
create policy loans_modify on loans for all using (is_admin() or is_secretary());

drop policy if exists loan_payments_select on loan_payments;
create policy loan_payments_select on loan_payments for select using (is_active());

drop policy if exists loan_payments_modify on loan_payments;
create policy loan_payments_modify on loan_payments for all using (is_admin() or is_secretary());

drop policy if exists fines_select on fines;
create policy fines_select on fines for select using (is_active());

drop policy if exists fines_modify on fines;
create policy fines_modify on fines for all using (is_admin() or is_secretary());

drop policy if exists fine_payments_select on fine_payments;
create policy fine_payments_select on fine_payments for select using (is_active());

drop policy if exists fine_payments_modify on fine_payments;
create policy fine_payments_modify on fine_payments for all using (is_admin() or is_secretary());

-- Meetings policies
drop policy if exists meetings_select on meetings;
create policy meetings_select on meetings for select using (is_active());

drop policy if exists meetings_modify on meetings;
create policy meetings_modify on meetings for all using (is_admin() or is_secretary());

drop policy if exists minutes_select on minutes;
create policy minutes_select on minutes for select using (is_active());

drop policy if exists minutes_modify on minutes;
create policy minutes_modify on minutes for all using (is_admin() or is_secretary());

-- Projects migration helpers (safe to run multiple times)
alter table if exists projects add column if not exists start_date date;
do $$ begin
  alter table projects drop constraint if exists projects_status_check;
exception when undefined_object then null; end $$;
alter table if exists projects
  add constraint projects_status_check check (status in ('ongoing','suspended','completed'));

-- Notifications policies
drop policy if exists notif_select_own on notifications;
create policy notif_select_own on notifications for select using (user_id = auth.uid());

drop policy if exists notif_admin_insert on notifications;
create policy notif_admin_insert on notifications for insert with check (is_admin());

-- allow users to mark their own notifications as read
drop policy if exists notif_update_own on notifications;
create policy notif_update_own on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin actions policies
drop policy if exists admin_actions_admin on admin_actions;
create policy admin_actions_admin on admin_actions for all using (is_admin());

-- General contributions (not tied to a project)
create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id),
  amount numeric(12,2) not null,
  date date not null,
  reason text not null check (reason in ('members_registration','end_of_year_party')),
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);
alter table contributions enable row level security;
drop policy if exists contributions_select on contributions;
create policy contributions_select on contributions for select using (is_active());
drop policy if exists contributions_modify on contributions;
create policy contributions_modify on contributions for all using (is_admin() or is_secretary()) with check (is_admin() or is_secretary());

-- Storage policies for avatar uploads (bucket: avatars)
do $$ begin
  create policy if not exists avatar_read on storage.objects
    for select using (bucket_id = 'avatars');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy if not exists avatar_insert on storage.objects
    for insert with check (bucket_id = 'avatars');
exception when duplicate_object then null; end $$;

-- RPC: set user status
create or replace function admin_set_user_status(target uuid, new_status user_status)
returns void
language plpgsql
security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update profiles set status = new_status where id = target;
  insert into admin_actions(actor_id, action, target, meta) values (auth.uid(), 'set_user_status', target, jsonb_build_object('status', new_status::text));
end; $$;

-- RPC: set user role
create or replace function admin_set_user_role(target uuid, new_role user_role)
returns void
language plpgsql
security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update profiles set role = new_role where id = target;
  insert into admin_actions(actor_id, action, target, meta) values (auth.uid(), 'set_user_role', target, jsonb_build_object('role', new_role::text));
end; $$;

-- Allow a user to update only their avatar via RPC
create or replace function user_set_avatar(new_url text)
returns void
language plpgsql
security definer set search_path = public as $$
begin
  update profiles set avatar_url = new_url where id = auth.uid();
end; $$;

-- Backfill and helpers for email-based admin actions
alter table if exists profiles add column if not exists email text;
create index if not exists idx_profiles_email on profiles((lower(email)));
update profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;

create or replace function admin_set_user_role_by_email(target_email text, new_role user_role)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  select id into uid from profiles where lower(email) = lower(target_email) limit 1;
  if uid is null then
    raise exception 'user with email % not found', target_email;
  end if;
  update profiles set role = new_role where id = uid;
  insert into admin_actions(actor_id, action, target, meta)
    values (auth.uid(), 'set_user_role_by_email', uid, jsonb_build_object('email', target_email, 'role', new_role::text));
end; $$;

create or replace function admin_set_user_status_by_email(target_email text, new_status user_status)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  select id into uid from profiles where lower(email) = lower(target_email) limit 1;
  if uid is null then
    raise exception 'user with email % not found', target_email;
  end if;
  update profiles set status = new_status where id = uid;
  insert into admin_actions(actor_id, action, target, meta)
    values (auth.uid(), 'set_user_status_by_email', uid, jsonb_build_object('email', target_email, 'status', new_status::text));
end; $$;
