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
