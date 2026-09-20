-- Anvil application schema
create table if not exists profiles (
  user_id text primary key,
  email text,
  display_name text,
  role text not null default 'user',
  plan_id text not null default 'free',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists profiles_one_super_admin
  on profiles (role) where role = 'super_admin';

create table if not exists plans (
  id text primary key,
  name text not null,
  price_paise int not null default 0,
  currency text not null default 'INR',
  interval_days int,
  daily_limit int,
  monthly_limit int,
  period_limit int,
  ad_free boolean not null default false,
  is_public boolean not null default true,
  blurb text not null default '',
  sort_order int not null default 0
);

create table if not exists subscriptions (
  id text primary key,
  user_id text not null,
  plan_id text not null,
  status text not null,
  period_start timestamptz,
  period_end timestamptz,
  provider text,
  provider_ref text,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on subscriptions (user_id);

create table if not exists usage_counters (
  subject_type text not null,
  subject_id text not null,
  bucket text not null,
  used int not null default 0,
  primary key (subject_type, subject_id, bucket)
);

create table if not exists usage_events (
  id serial primary key,
  subject_type text not null,
  subject_id text not null,
  tool_slug text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_subject_idx
  on usage_events (subject_type, subject_id, created_at desc);

create table if not exists orders (
  id text primary key,
  user_id text not null,
  plan_id text not null,
  amount_paise int not null,
  currency text not null default 'INR',
  status text not null,
  provider text not null,
  coupon_code text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_idx on orders (user_id);

create table if not exists coupons (
  code text primary key,
  percent_off int,
  amount_off_paise int,
  active boolean not null default true,
  max_redemptions int,
  redeemed int not null default 0
);

create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists cms_pages (
  id serial primary key,
  slug text unique not null,
  title text not null,
  body text not null,
  meta_title text,
  meta_description text,
  status text not null default 'published',
  kind text not null default 'page',
  noindex boolean not null default false,
  published_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

create table if not exists faqs (
  id serial primary key,
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  tool_slug text
);

create table if not exists tool_overrides (
  slug text primary key,
  enabled boolean not null default true,
  featured boolean not null default false,
  homepage boolean not null default false
);

create table if not exists audit_logs (
  id serial primary key,
  user_id text,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists reward_events (
  id text primary key,
  user_id text not null,
  provider text not null,
  credits int not null,
  created_at timestamptz not null default now()
);

insert into plans (id, name, price_paise, interval_days, daily_limit, monthly_limit, period_limit, ad_free, blurb, sort_order)
values
  ('guest', 'Guest', 0, null, 10, null, null, false, 'Try tools without an account. 10 uses per day.', 0),
  ('free', 'Free Forever', 0, null, null, 25, null, false, 'A modest monthly allowance for occasional work.', 1),
  ('standard', 'Standard', 900, 30, 100, null, 3000, false, 'Daily headroom for regular document work.', 2),
  ('premium', 'Premium', 3900, 30, 500, null, 15000, true, 'High limits and no advertisements.', 3)
on conflict (id) do nothing;

insert into settings (key, value) values
  ('brand_name', '"Anvil"'),
  ('tagline', '"Free online tools for PDF, images, text, developers, and more."'),
  ('ads_enabled', 'false'),
  ('ads_provider', '"none"'),
  ('adsense_client', '""'),
  ('seo_tools_enabled', 'true'),
  ('reward_credits', '3'),
  ('maintenance', 'false')
on conflict (key) do nothing;

insert into coupons (code, percent_off, active, max_redemptions, redeemed)
values ('WELCOME10', 10, true, 1000, 0)
on conflict (code) do nothing;

insert into cms_pages (slug, title, body, meta_title, meta_description, kind, status)
values
(
  'privacy',
  'Privacy',
  $p$Anvil processes files in your browser whenever a tool can run locally. PDF, image, text, calculator, and generator tools do not upload your documents to our servers.

If you create an account we store your email, display name, plan, usage counters, and billing records needed to run the product. Session cookies keep you signed in. A theme preference may be stored in localStorage.

We do not sell personal data. We do not run hidden trackers. Advertisements appear only when a Super Admin enables a provider, and never as a reward for clicking ordinary display ads.

You can export or delete account data from the account page. Deleting an account removes application records we control. Authentication records are cleared on sign-out.

Contact the site operator through the contact page for privacy requests.$p$,
  'Privacy — Anvil',
  'How Anvil handles files, accounts, cookies, and advertising.',
  'legal',
  'published'
),
(
  'terms',
  'Terms',
  $p$Anvil is provided as online utility software. Tools are offered as-is. Browser-side processing means results depend on your device. You are responsible for the files you open and for keeping copies of anything important.

Free and guest allowances exist to keep the service usable. Paid plans, when purchased, last for the stated billing period and do not automatically activate from a browser redirect — payment must be verified.

Do not use Anvil to process material you are not allowed to handle, to attack other systems, or to upload malware. We may suspend accounts that abuse usage limits or payment flows.

The software is provided without warranties of merchantability or fitness for a particular purpose.$p$,
  'Terms — Anvil',
  'Terms of use for the Anvil online tools platform.',
  'legal',
  'published'
),
(
  'cookies',
  'Cookies',
  $p$Essential cookies: sign-in session cookies required to keep an account open.

Preferences: theme (light, dark, or system) is stored in localStorage, not a tracking cookie.

Guest usage: daily guest limits are stored in localStorage on your device.

Advertising cookies are not set unless a Super Admin enables an advertising provider. You can refuse non-essential cookies by staying on the default settings and not enabling third-party ads.$p$,
  'Cookies — Anvil',
  'Cookie and local storage use on Anvil.',
  'legal',
  'published'
),
(
  'about',
  'About',
  $p$Anvil is a workshop of everyday utilities — PDFs, images, text, developer helpers, calculators, and SEO snippets — designed to run quickly in the browser.

Files stay on your device for supported tools. Accounts exist so usage limits, plans, and preferences can follow you.

The public site is meant to be calm, accessible, and honest: if a tool cannot run, it says so instead of inventing output.$p$,
  'About — Anvil',
  'What Anvil is and how the tools work.',
  'page',
  'published'
),
(
  'contact',
  'Contact',
  $p$For support, billing, or privacy requests, sign in and use the account page, or email the operator configured for this installation.

This preview does not include a live mailbox. Messages are not sent anywhere unless the operator configures mail.$p$,
  'Contact — Anvil',
  'How to reach the Anvil operator.',
  'page',
  'published'
),
(
  'how-anvil-keeps-files-local',
  'How Anvil keeps files on your device',
  $p$Most Anvil tools run entirely in the browser. A PDF merge copies pages with a client-side library. Image compression draws to a canvas. JSON formatting never leaves the page.

That design has two effects: your documents are not stored on our servers after you close the tab, and heavy tools still need a capable device.

Usage limits still apply. Limits exist to keep the product fair, not because we uploaded your file.

Paid plans raise those limits. They do not change the privacy model of browser-side tools.$p$,
  'How Anvil keeps files on your device',
  'Why PDF and image tools run in the browser, and what that means for privacy.',
  'blog',
  'published'
),
(
  'a-quiet-guide-to-everyday-pdf-tasks',
  'A quiet guide to everyday PDF tasks',
  $p$Merge when a packet should travel as one file. Split when a chapter should stand alone. Compress when an email refuses a large attachment — compression redraws pages as JPEG, which is lossy.

Protect a PDF when you want a password barrier; unlocking requires that password. Metadata viewing never changes the file.

None of these replace a records system. Keep originals.$p$,
  'A quiet guide to everyday PDF tasks',
  'When to merge, split, compress, or protect a PDF.',
  'blog',
  'published'
)
on conflict (slug) do nothing;

insert into faqs (question, answer, sort_order) values
  ('Are my files uploaded?', 'Supported PDF, image, text, and generator tools run in your browser. Files are not uploaded to Anvil servers for those tools.', 1),
  ('Do I need an account?', 'No. Guests can run a limited number of tools each day. An account raises the allowance and keeps usage across devices.', 2),
  ('How do paid plans start?', 'Checkout creates a pending order. A plan is activated only after payment is verified — never from a redirect alone.', 3),
  ('Why did a PDF get larger after compress?', 'Compression redraws pages as images. Simple text PDFs can grow. Check the size report before you discard the original.', 4);
