-- 0. Setup Trigger Function for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 1. SHOPS & CATEGORIES
CREATE TABLE shops (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS (Linked to Category)
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  item_code TEXT NOT NULL,
  photo_url TEXT,
  cost_price NUMERIC(12, 2) DEFAULT 0,
  overhead_expense NUMERIC(12, 2) DEFAULT 0,
  selling_price NUMERIC(12, 2) DEFAULT 0,
  vendor_name TEXT,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, item_code)
);

-- 3. INVENTORY (With User Tracking)
CREATE TABLE inventory (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  qty_display INT DEFAULT 0,
  qty_godown INT DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id), -- Tracks who last moved stock
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLIENTS
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS (The Transaction)
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  user_id UUID REFERENCES auth.users(id), -- The staff/admin who made the sale
  status TEXT DEFAULT 'bucket' CHECK (status IN ('bucket', 'pi', 'sold', 'cancelled')),
  discount_percent NUMERIC(5, 2) DEFAULT 0,
  final_total NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDER HISTORY (Snapshots)
CREATE TABLE order_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id), -- Who performed this negotiation step
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. APPLY TIMESTAMP TRIGGERS
-- Run this for every table to automate the 'updated_at' column
CREATE TRIGGER update_shops_modtime BEFORE UPDATE ON shops FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_inventory_modtime BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


---DELETE LATER: SAMPLE DATA INSERTION
-- 1. Create the Shop (Run this first to get the shop_id)
INSERT INTO shops (name) 
VALUES ('The Light Code') 
RETURNING id;

-- 2. Create a Category (Use the shop_id from step 1)
INSERT INTO categories (shop_id, name) 
VALUES 
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'chandelier') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'wall light') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'hanging') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'big hanging') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'stick to ceiling'),
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'mirror light') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'outdoor') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'fan'),
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'lamp') ,
('102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 'bulb') 
;

select * from categories;

-- 3. Insert the Product
INSERT INTO products (
    shop_id, 
    category_id, 
    item_code, 
    cost_price, 
    selling_price, 
    vendor_name, 
    remark
) VALUES (
    '102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 
    'e7384208-8538-4e74-a479-962e4415ee28', 
    '8001/600', 
    12650, 
    15000, -- Assigned a sample selling price
    'MAYARAM', 
    'spray needs to be done'
) RETURNING id;

-- 4. Insert the Initial Inventory (Use the product_id from step 3)
INSERT INTO inventory (
    product_id, 
    shop_id, 
    qty_display, 
    qty_godown
) VALUES (
    '9a569324-e616-432c-bbf8-1d40c01aa6f6', 
    '102e6445-6462-4cb6-bcbf-e9dd43a70b7e', 
    1, 
    10
);