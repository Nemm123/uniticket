-- MIGRATION 004
ALTER TABLE event_ticket_tiers
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE event_ticket_tiers
  DROP CONSTRAINT IF EXISTS event_ticket_tiers_inventory_check;

ALTER TABLE event_ticket_tiers
  ADD CONSTRAINT event_ticket_tiers_inventory_check
  CHECK (
    reserved_quantity >= 0
    AND reserved_quantity <= total_quantity
    AND remaining_quantity >= 0
    AND remaining_quantity + reserved_quantity <= total_quantity
  );

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  buyer_wallet TEXT NOT NULL REFERENCES wallet_identities(wallet_address) ON DELETE RESTRICT,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'reserved', 'demo_paid', 'completed', 'cancelled', 'expired', 'refunded')),
  subtotal NUMERIC(18, 9) NOT NULL CHECK (subtotal >= 0),
  total NUMERIC(18, 9) NOT NULL CHECK (total >= 0),
  currency TEXT NOT NULL DEFAULT 'SOL' CHECK (currency = 'SOL'),
  idempotency_key TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_wallet, idempotency_key)
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  tier_id UUID NOT NULL REFERENCES event_ticket_tiers(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(18, 9) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(18, 9) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, tier_id)
);

CREATE INDEX IF NOT EXISTS orders_buyer_created_idx ON orders (buyer_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_expiry_reserved_idx ON orders (expires_at) WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS orders_event_idx ON orders (event_id);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_tier_idx ON order_items (tier_id);

-- MIGRATION 005
-- Phase 1: VND-only sales and backend-owned payment/ticket lifecycle.
-- Legacy SOL columns remain temporarily for data preservation; new writes use VND columns only.

ALTER TABLE event_ticket_tiers
  ADD COLUMN IF NOT EXISTS price_vnd BIGINT;

-- This is an explicit demo-catalog assignment, not a SOL-to-VND exchange conversion.
UPDATE event_ticket_tiers
SET price_vnd = CASE
  WHEN lower(name) LIKE '%vip%' THEN 799000
  ELSE 499000
END
WHERE price_vnd IS NULL;

ALTER TABLE event_ticket_tiers
  ALTER COLUMN price_vnd SET NOT NULL;

ALTER TABLE event_ticket_tiers
  DROP CONSTRAINT IF EXISTS event_ticket_tiers_price_vnd_check;

ALTER TABLE event_ticket_tiers
  ADD CONSTRAINT event_ticket_tiers_price_vnd_check CHECK (price_vnd >= 0);

ALTER TABLE orders
  ALTER COLUMN buyer_wallet DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_access_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS service_fee_vnd BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'DEMO_PAYMENT',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS payment_provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_currency_check,
  DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders
SET currency = 'VND',
    subtotal_vnd = COALESCE(subtotal_vnd, 0),
    total_vnd = COALESCE(total_vnd, 0)
WHERE currency <> 'VND' OR subtotal_vnd IS NULL OR total_vnd IS NULL;

ALTER TABLE orders
  ALTER COLUMN currency SET DEFAULT 'VND',
  ALTER COLUMN subtotal_vnd SET NOT NULL,
  ALTER COLUMN total_vnd SET NOT NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_currency_check CHECK (currency = 'VND'),
  ADD CONSTRAINT orders_vnd_totals_check CHECK (
    subtotal_vnd >= 0 AND service_fee_vnd >= 0 AND total_vnd = subtotal_vnd + service_fee_vnd
  ),
  ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('PENDING', 'PAYMENT_PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'PAYMENT_PENDING', 'PAID', 'NFT_MINTING', 'NFT_MINTED', 'TICKET_ACTIVE', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PAYMENT_FAILED', 'NFT_MINT_FAILED'));

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_price_vnd BIGINT,
  ADD COLUMN IF NOT EXISTS total_price_vnd BIGINT;

UPDATE order_items
SET unit_price_vnd = COALESCE(unit_price_vnd, 0),
    total_price_vnd = COALESCE(total_price_vnd, 0)
WHERE unit_price_vnd IS NULL OR total_price_vnd IS NULL;

ALTER TABLE order_items
  ALTER COLUMN unit_price_vnd SET NOT NULL,
  ALTER COLUMN total_price_vnd SET NOT NULL,
  ADD CONSTRAINT order_items_vnd_price_check CHECK (
    unit_price_vnd >= 0 AND total_price_vnd = unit_price_vnd * quantity
  );

ALTER TABLE tickets
  ALTER COLUMN customer_wallet DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS owner_wallet TEXT,
  ADD COLUMN IF NOT EXISTS nft_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS nft_mint_address TEXT,
  ADD COLUMN IF NOT EXISTS nft_transaction_signature TEXT,
  ADD COLUMN IF NOT EXISTS nft_metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS nft_error TEXT,
  ADD COLUMN IF NOT EXISTS qr_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_nft_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_nft_status_check CHECK (nft_status IN ('PENDING', 'MINTING', 'MINTED', 'MINT_FAILED'));

UPDATE tickets
SET checked_in_at = check_in_time
WHERE checked_in_at IS NULL AND check_in_time IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_qr_token_hash_unique
  ON tickets (qr_token_hash) WHERE qr_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_owner_wallet_idx ON tickets (owner_wallet);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status, status);

-- MIGRATION 006
-- 006: Add customer info to orders for VND checkout flow.
-- customer_name and customer_email are collected at checkout and stored on the order.
-- Tickets inherit these values when issued after payment verification.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';

ALTER TABLE orders
  ADD CONSTRAINT orders_customer_email_check CHECK (
    customer_email = '' OR customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

CREATE INDEX IF NOT EXISTS orders_customer_name_idx ON orders (customer_name);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (customer_email);
