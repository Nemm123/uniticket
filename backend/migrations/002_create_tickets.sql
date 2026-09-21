CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_title TEXT NOT NULL DEFAULT '',
  event_banner TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL DEFAULT '',
  event_time TEXT NOT NULL DEFAULT '',
  tier_id TEXT NOT NULL DEFAULT '',
  tier_name TEXT NOT NULL DEFAULT '',
  seat TEXT NOT NULL DEFAULT '',
  price_sol NUMERIC(18, 9) NOT NULL DEFAULT 0,
  ticket_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_wallet TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'checked_in', 'transferred', 'cancelled')),
  is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
  check_in_time TIMESTAMPTZ,
  checked_in_by TEXT,
  qr_payload TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_event_id_idx ON tickets (event_id);
CREATE INDEX IF NOT EXISTS tickets_customer_wallet_idx ON tickets (customer_wallet);
CREATE INDEX IF NOT EXISTS tickets_ticket_code_idx ON tickets (ticket_code);
CREATE INDEX IF NOT EXISTS tickets_order_id_idx ON tickets (order_id);
CREATE INDEX IF NOT EXISTS tickets_is_checked_in_idx ON tickets (is_checked_in);
