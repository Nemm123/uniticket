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
