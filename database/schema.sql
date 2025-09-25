-- Enable extensions
create extension if not exists pgcrypto;

-- 1) customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  phone text,
  name text not null,
  created_at timestamptz default now()
);

-- 2) quote_submissions
create table if not exists public.quote_submissions (
  quote_id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  client_name text not null,
  client_email text not null,
  phone text,
  source_lang text not null,
  target_lang text not null,
  intended_use text not null,
  status text default 'pending',          -- pending|ready|hitl|failed|accepted|paid
  payment_status text default 'unpaid',   -- unpaid|paid|refunded
  hitl_requested boolean default false,
  hitl_required boolean default false,
  hitl_resolved_at timestamptz,
  delivery_option_id integer references public.delivery_options(id) on delete set null,
  delivery_eta_date date,
  created_at timestamptz default now()
);

-- 3) quote_files
create table if not exists public.quote_files (
  id bigserial primary key,
  quote_id uuid not null references public.quote_submissions(quote_id) on delete cascade,
  file_id uuid not null,
  filename text not null,
  storage_path text not null,
  signed_url text,
  bytes bigint not null,
  content_type text,
  uploaded_at timestamptz default now()
);

-- 4) quote_results -- written by n8n
create table if not exists public.quote_results (
  quote_id uuid primary key references public.quote_submissions(quote_id) on delete cascade,
  results_json jsonb,
  currency text default 'CAD',
  subtotal numeric,
  tax numeric,
  total numeric,
  eta_business_days integer,
  computed_at timestamptz default now()
);

-- 5) payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_submissions(quote_id) on delete cascade,
  stripe_pi text not null,
  amount numeric not null,
  currency text not null default 'CAD',
  status text not null,               -- requires_payment|succeeded|refunded|failed
  created_at timestamptz default now()
);

-- 6) invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_submissions(quote_id) on delete cascade,
  qbo_id text,
  total numeric not null,
  link text,
  created_at timestamptz default now()
);

-- 7) tiers
create table if not exists public.tiers (
  id serial primary key,
  name text unique,
  multiplier numeric
);

-- 8) languages
create table if not exists public.languages (
  code text primary key,
  name text,
  tier_id int references public.tiers(id)
);

-- 9) cert_types
create table if not exists public.cert_types (
  id serial primary key,
  name text unique,
  pricing_type text check (pricing_type in ('flat','multiplier')),
  amount numeric default 0
);

-- 10) complexity
create table if not exists public.complexity (
  id serial primary key,
  name text unique,
  multiplier numeric
);

-- 11) shipping_methods
create table if not exists public.shipping_methods (
  id serial primary key,
  name text unique,
  price numeric default 0,
  has_tracking boolean default false
);

-- 12) tax_policy
create table if not exists public.tax_policy (
  region text primary key,
  rate numeric,
  is_hst boolean default false,
  outside_ca_zero boolean default false
);

-- 13) glm_overrides
create table if not exists public.glm_overrides (
  id serial primary key,
  doc_type text not null,
  country text,
  flat_price numeric not null
);

-- 14) app_settings (singleton)
create table if not exists public.app_settings (
  id boolean primary key default true,
  base_rate numeric not null,
  page_divisor numeric not null default 225,
  rate_round_to integer not null default 5,
  page_round_step numeric not null default 0.25,
  page_round_threshold numeric not null default 0.20,
  rush_percent numeric not null default 0.30,
  delivery_rule jsonb,
  same_day_cutoff_local_time text default '14:00',
  same_day_cutoff_weekdays text default '1,2,3,4,5',
  timezone text default 'America/Edmonton'
);

-- 15) delivery_options
create table if not exists public.delivery_options (
  id serial primary key,
  name text unique not null,
  base_business_days int not null default 2,
  addl_business_days_per_pages int not null default 4,
  addl_business_days int not null default 1,
  fee_type text not null default 'flat' check (fee_type in ('flat','percent')),
  fee_amount numeric not null default 0,
  is_expedited boolean not null default false,
  is_same_day boolean not null default false,
  active boolean not null default true,
  display_order int not null default 100
);

-- 16) same_day_qualifiers
create table if not exists public.same_day_qualifiers (
  id serial primary key,
  doc_type text not null,
  country text not null,
  active boolean not null default true,
  unique (doc_type, country)
);
