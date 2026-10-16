-- SOMON FOOD — PostgreSQL schema (production). Mirrors the JSON store used by the prototype.
-- Money is stored in dirams (1 TJS = 100 dirams) as INTEGER to avoid float errors.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role    AS ENUM ('customer','restaurant','courier','admin');
CREATE TYPE order_status AS ENUM ('awaiting_payment','pending','cooking','ready','picked_up','delivered','rejected','cancelled');
CREATE TYPE pay_method   AS ENUM ('cash','card');
CREATE TYPE pay_status   AS ENUM ('pending','paid','declined','refunded','cash_due','cash_collected');
CREATE TYPE vehicle      AS ENUM ('scooter','bike','car','foot');

CREATE TABLE cities (
  id TEXT PRIMARY KEY, name JSONB NOT NULL,            -- {"tg":"Душанбе","ru":"Душанбе","en":"Dushanbe"}
  lat NUMERIC(9,6) NOT NULL, lng NUMERIC(9,6) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE users (
  id TEXT PRIMARY KEY, role user_role NOT NULL DEFAULT 'customer',
  name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE CHECK (phone ~ '^\+992[0-9]{9}$'),
  password_hash TEXT NOT NULL, lang TEXT NOT NULL DEFAULT 'tg' CHECK (lang IN ('tg','ru','en')),
  city_id TEXT REFERENCES cities(id), active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE addresses (
  id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL, landmark TEXT, lat NUMERIC(9,6), lng NUMERIC(9,6), created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE couriers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  online BOOLEAN NOT NULL DEFAULT FALSE, vehicle vehicle NOT NULL DEFAULT 'scooter',
  rating NUMERIC(2,1), rating_count INT NOT NULL DEFAULT 0, lat NUMERIC(9,6), lng NUMERIC(9,6), seen_at TIMESTAMPTZ);

CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL);

CREATE TABLE categories (id TEXT PRIMARY KEY, name JSONB NOT NULL, icon TEXT NOT NULL, sort INT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), city_id TEXT NOT NULL REFERENCES cities(id),
  name JSONB NOT NULL, cuisine JSONB, address JSONB, phone TEXT, tone TEXT,
  lat NUMERIC(9,6) NOT NULL, lng NUMERIC(9,6) NOT NULL,
  open_from TIME NOT NULL DEFAULT '09:00', open_to TIME NOT NULL DEFAULT '23:00', accepting BOOLEAN NOT NULL DEFAULT TRUE,
  eta_min INT NOT NULL DEFAULT 35, min_order INT NOT NULL DEFAULT 2000,
  commission_pct NUMERIC(4,1) NOT NULL DEFAULT 15 CHECK (commission_pct BETWEEN 0 AND 50),
  rating NUMERIC(2,1), rating_count INT NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ON restaurants(city_id) WHERE active;

CREATE TABLE products (
  id TEXT PRIMARY KEY, restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id), name JSONB NOT NULL, description JSONB,
  price INT NOT NULL CHECK (price > 0), weight TEXT, kind TEXT, image_url TEXT,
  popular BOOLEAN NOT NULL DEFAULT FALSE, available BOOLEAN NOT NULL DEFAULT TRUE, deleted_at TIMESTAMPTZ);
CREATE INDEX ON products(restaurant_id) WHERE deleted_at IS NULL;

CREATE TABLE promos (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value INT NOT NULL, min_order INT NOT NULL DEFAULT 0, max_uses INT, used INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE banners (id TEXT PRIMARY KEY, city_id TEXT REFERENCES cities(id), title JSONB NOT NULL, subtitle JSONB, tone TEXT, art TEXT, link TEXT, sort INT DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE);

CREATE TABLE orders (
  id TEXT PRIMARY KEY, number INT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES users(id), restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  courier_id TEXT REFERENCES users(id), city_id TEXT NOT NULL REFERENCES cities(id),
  status order_status NOT NULL, address JSONB NOT NULL, phone TEXT NOT NULL, comment TEXT,
  subtotal INT NOT NULL, discount INT NOT NULL DEFAULT 0, delivery_fee INT NOT NULL, total INT NOT NULL, km NUMERIC(5,1),
  promo_id TEXT REFERENCES promos(id), prep_min INT,
  commission INT, courier_pay INT, restaurant_payout INT, platform_income INT,   -- money split, set on delivery
  reject_reason TEXT, cancelled_by user_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), accepted_at TIMESTAMPTZ, ready_at TIMESTAMPTZ,
  picked_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ON orders(restaurant_id, created_at DESC);
CREATE INDEX ON orders(customer_id, created_at DESC);
CREATE INDEX ON orders(courier_id, created_at DESC);
CREATE INDEX ON orders(city_id, status) WHERE status IN ('pending','cooking','ready','picked_up');

CREATE TABLE order_items (order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id TEXT REFERENCES products(id),
  name JSONB NOT NULL, price INT NOT NULL, qty INT NOT NULL CHECK (qty BETWEEN 1 AND 50), kind TEXT, PRIMARY KEY (order_id, product_id));

CREATE TABLE order_events (id BIGSERIAL PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status, to_status order_status NOT NULL, actor_id TEXT REFERENCES users(id), at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE payments (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), method pay_method NOT NULL, status pay_status NOT NULL,
  amount INT NOT NULL, provider TEXT NOT NULL DEFAULT 'mock', provider_ref TEXT, card_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ON payments(order_id);

CREATE TABLE reviews (order_id TEXT PRIMARY KEY REFERENCES orders(id), rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  courier_rating SMALLINT CHECK (courier_rating BETWEEN 1 AND 5), comment TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE notifications (id TEXT PRIMARY KEY, target TEXT NOT NULL,   -- 'u:<id>' | 'rest:<id>' | 'couriers:<city>' | 'admins'
  key TEXT NOT NULL, params JSONB, order_id TEXT REFERENCES orders(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE notification_reads (notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (notification_id, user_id));
CREATE INDEX ON notifications(target, created_at DESC);

CREATE TABLE settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);   -- delivery_base, per_km, min_fee, courier_pct, support_phone, default_city
