CREATE TYPE common_status AS ENUM ('active', 'inactive');
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(50),
  isMainBranch BOOLEAN DEFAULT FALSE,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  status common_status DEFAULT 'active',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vai trò: CUSTOMER (khách hàng), SHOP_OWNER (Chủ shop), ADMIN (quản trị hệ thống), BRANCH_MANAGER (Quản lý chi nhánh)
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'SHOP_OWNER', 'ADMIN', 'BRANCH_MANAGER');
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  phoneNumber VARCHAR(20) UNIQUE,
  password VARCHAR(255) NOT NULL,            -- hashed password
  hashedRefreshToken VARCHAR(255),           -- nullable token
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  branchId INT REFERENCES branches(id) ON DELETE SET NULL, -- nếu user là chủ/nhân viên chi nhánh
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- brands: thương hiệu sản phẩm
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status common_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- categories: danh mục sản phẩm (cây phân cấp)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    image VARCHAR(500),
    parentId INT DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- products: thông tin chung của sản phẩm (group)
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
--   sku_group VARCHAR(100),        -- optional: mã nhóm sản phẩm
  name VARCHAR(255) NOT NULL,
  brandId INT REFERENCES brands(id) ON DELETE SET NULL,
  categoryId INT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  image VARCHAR(500),
  stock INT DEFAULT 0,               -- tổng tồn kho tất cả variant ở tất cả chi nhánh
  status common_status DEFAULT 'active',
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- attributes: danh sách các thuộc tính (color, size, material, ...)
CREATE TYPE attribute_type AS ENUM ('common', 'other');
CREATE TABLE attributes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,      -- 'color', 'size', 'material', ...
  type attribute_type DEFAULT 'common', -- 'common'|'other' (thuộc tính chung (Màu sắc, Kích thước, Chất liệu) hay riêng) 
--   presentationName VARCHAR(100)    -- 'Màu sắc', 'Size', ...
);

-- attribute_values: các giá trị có thể chọn cho attribute
CREATE TABLE attribute_values (
  id SERIAL PRIMARY KEY,
  attributeId INT NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value VARCHAR(200) NOT NULL,      -- 'Red', 'S', 'Cotton'
  meta JSONB DEFAULT '{}'           -- mã màu hex, ảnh... (Postgres JSONB)
);

-- product_attribute: xác định attribute nào áp dụng cho product
CREATE TABLE product_attributes (
  id SERIAL PRIMARY KEY,
  productId INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attributeId INT NOT NULL REFERENCES attributes(id),
  isRequired BOOLEAN DEFAULT true
);

-- product_variants: từng biến thể cụ thể (mỗi variant 1 SKU)
CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  productId INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
--   sku VARCHAR(100) UNIQUE NOT NULL,         -- SKU duy nhất hệ thống
  price NUMERIC(12,2) NOT NULL,
  image VARCHAR(500),                       -- ảnh riêng của variant (nếu có)
--   listPrice NUMERIC(12,2),
--   stock INT DEFAULT 0,
  weight NUMERIC(8,3),
  status common_status DEFAULT 'active',
  extra JSONB DEFAULT '{}',                 -- lưu metadata tuỳ ý
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- variant_attribute_values: mapping variant <-> attribute_value
CREATE TABLE variant_attribute_values (
  id SERIAL PRIMARY KEY,
  variantId INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attributeId INT NOT NULL REFERENCES attributes(id),
  attributeValueId INT NOT NULL REFERENCES attribute_values(id),
  UNIQUE(variantId, attributeId)
);

-- product_variants_inventory: tồn kho từng biến thể sản phẩm theo chi nhánh
CREATE TABLE IF NOT EXISTS product_variants_inventory (
    id SERIAL PRIMARY KEY,
    variantId INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    branchId INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    stock INT DEFAULT 0,
    status common_status DEFAULT 'active',
    UNIQUE(variantId, branchId)
);

-- collections: bộ sưu tập sản phẩm
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,
    image VARCHAR(500),
    status common_status DEFAULT 'active',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- collection_products: liên kết sản phẩm với bộ sưu tập
CREATE TABLE IF NOT EXISTS collection_products (
    id SERIAL PRIMARY KEY,
    collectionId INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    productId INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    displayOrder INT DEFAULT 0,
    UNIQUE(collectionId, productId)
);

-- promotions: thông tin khuyến mãi
-- Loại khuyến mãi: DISCOUNT (giảm giá theo % hoặc số tiền cố định), COMBO (bán combo sản phẩm), COUPON (mã giảm giá)
-- Phạm vi áp dụng: GLOBAL (toàn bộ), BRANCH (chi nhánh cụ thể), CUSTOMER_GROUP (nhóm khách hàng cụ thể)
-- Điều kiện áp dụng: giá trị đơn hàng tối thiểu, số tiền giảm tối đa, số lần sử dụng tối đa của khách hàng
-- Áp dụng cho: sản phẩm cụ thể, nhóm khách hàng cụ thể, chi nhánh cụ thể
-- Lịch sử áp dụng: lưu lại khách hàng đã sử dụng khuyến mã nào, giảm bao nhiêu tiền, đơn hàng nào
-- =========================================================
CREATE TYPE promotion_type AS ENUM ('COMBO', 'COUPON'); -- (PHẠM VI: (BRANCH, GLOBAL, CUSTOMER_GROUP) :Combo (Giảm giá combo, Mua x tặng y), Mã giảm giá (giảm giá cho sản phẩm cụ thể, giảm giá theo đơn hàng))
CREATE TYPE combo_type AS ENUM ('product_combo', 'buy_x_get_y');
CREATE TYPE coupon_type AS ENUM ('order_total', 'specific_products');
CREATE TYPE discount_type AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE apply_scope AS ENUM ('GLOBAL', 'BRANCH', 'CUSTOMER_GROUP');
-- =========================================================
CREATE TABLE promotions (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    code          VARCHAR(100) UNIQUE,  -- mã khuyến mãi (nếu có)
    description     TEXT,
    type            promotion_type NOT NULL,
    comboType       combo_type,
    couponType      coupon_type,
    discountValue  DECIMAL(10,2) DEFAULT 0,
    discountType   discount_type DEFAULT 'PERCENT',
    startDate      TIMESTAMP WITH TIME ZONE NOT NULL,
    endDate        TIMESTAMP WITH TIME ZONE NOT NULL,
    minOrderValue DECIMAL(10,2) DEFAULT 0,
    maxDiscount    DECIMAL(10,2),
    usageLimit     INT DEFAULT NULL,
    usedCount      INT DEFAULT 0,
    applyScope     apply_scope DEFAULT 'GLOBAL',
    isActive       BOOLEAN DEFAULT TRUE,
    createdAt      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE TYPE promotion_condition_role AS ENUM (
    'BUY',        -- Điều kiện MUA (cho Combo và BOGO)
    'GET',        -- Phần thưởng NHẬN (cho BOGO)
    'APPLIES_TO'  -- Sản phẩm mà Coupon (loại specific_products) áp dụng
);
CREATE TABLE promotion_conditions (
    id              SERIAL PRIMARY KEY,
    promotionId     BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    productId      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity     INT NOT NULL DEFAULT 1,
    role            promotion_condition_role NOT NULL,
    UNIQUE(promotionId, productId, role)
);

-- =========================================================
-- Bảng: promotion_branches
-- Áp dụng cho chi nhánh cụ thể
-- =========================================================
CREATE TABLE promotion_branches (
    id             SERIAL PRIMARY KEY,
    promotionId    INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    branchId       INT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    createdAt      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(promotionId, branchId)
);

-- Bảng customer_groups (nhóm khách hàng: VIP, wholesale, new-customer, ...)
CREATE TABLE customer_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng user_customer_groups (liên kết người dùng với nhóm khách hàng)
CREATE TABLE IF NOT EXISTS user_customer_groups (
  userId INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customerGroupId INT NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
  assignedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (userId, customerGroupId)
);

-- =========================================================
-- Bảng: promotion_customer_groups
-- Áp dụng cho nhóm khách hàng (VD: VIP, thành viên, đại lý)
-- =========================================================
CREATE TABLE promotion_customer_groups (
    id                  SERIAL PRIMARY KEY,
    promotionId         INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    customerGroupId     INT REFERENCES customer_groups(id) ON DELETE CASCADE,
    createdAt           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- Bảng: addresses
-- Lưu thông tin địa chỉ của khách hàng
-- =========================================================
CREATE TYPE address_type_enum AS ENUM (
    'home',  -- Nhà riêng
    'other'  -- Khác
);
CREATE TABLE addresses (
    -- Khóa chính
    id BIGSERIAL PRIMARY KEY,
    
    -- Liên kết với khách hàng (NULL nếu là khách vãng lai)
    userId BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Thông tin người nhận (Bắt buộc)
    fullName VARCHAR(255) NOT NULL,
    phoneNumber VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,

    -- Thông tin địa chỉ chi tiết (từ form)
    street TEXT,
    ward VARCHAR(100),
    district VARCHAR(100),
    province VARCHAR(100) NOT NULL,

    -- Thông tin từ bản đồ (Map)
    -- DECIMAL(10, 8) cho vĩ độ (latitude)
    -- DECIMAL(11, 8) cho kinh độ (longitude)
    lat DECIMAL(10, 8),
    long DECIMAL(11, 8),

    -- Địa chỉ đầy đủ trả về từ API (ví dụ: "123 Nguyễn Trãi, P. Bến Thành, Q.1...")
    fullAddress TEXT,

    -- Thông tin bổ sung (cho khách hàng có tài khoản)
      addressType address_type_enum, -- Sử dụng kiểu ENUM đã tạo
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,

    -- Dấu thời gian
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====== orders: Đơn hàng ======
CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');
CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER');
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  orderNumber VARCHAR(50) UNIQUE NOT NULL, -- e.g. "ORD-20251010-0001"
  userId INT REFERENCES users(id),
  branchId INT REFERENCES branches(id), -- branch assigned to fulfill the order
  status order_status DEFAULT 'PENDING',
  subTotal NUMERIC(12,2) NOT NULL DEFAULT 0,   -- sum of items before discounts/shipping
  discountTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shippingFee NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  totalAmount NUMERIC(12,2) NOT NULL DEFAULT 0, -- final amount payable
  note TEXT,
  paymentMethod payment_method DEFAULT 'CASH',
  expectedDeliveryDate TIMESTAMP WITH TIME ZONE,
  paidAt TIMESTAMP WITH TIME ZONE,
  deliveredAt TIMESTAMP WITH TIME ZONE,
  cancelledAt TIMESTAMP WITH TIME ZONE,
  shippingAddressJson JSONB, -- lưu tạm address ở thời điểm đặt
  billingAddressJson JSONB,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====== order_items: Chi tiết đơn hàng ======
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  orderId INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variantId INT REFERENCES product_variants(id),
  quantity INT DEFAULT 1,
  subTotal NUMERIC(12,2) NOT NULL, -- price * quantity
  discountTotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  totalAmount NUMERIC(12,2) NOT NULL, -- final amount after discount
  isGift BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====== carts: Giỏ hàng ======
CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  userId INT REFERENCES users(id),
  sessionKey VARCHAR(255), -- for guest cart
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====== cart_items: Chi tiết giỏ hàng ======
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cartId INT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variantId INT,
  quantity INT DEFAULT 1
);

-- =========================================================
-- Bảng: promotion_logs
-- Lưu lịch sử khách hàng đã áp dụng khuyến mãi
-- =========================================================
CREATE TABLE promotion_logs (
    id              SERIAL PRIMARY KEY,
    promotionId    INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    userId         INT NOT NULL,
    orderId        INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    discountAmount DECIMAL(10,2) DEFAULT 0,
    createdAt      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- Dữ liệu mẫu
-- =========================================================
INSERT INTO promotions (name, description, type, "discountValue", "discountType", "startDate", "endDate", "applyScope")
VALUES
('Giảm 10% toàn bộ sản phẩm', 'Áp dụng toàn shop', 'DISCOUNT', 10, 'PERCENT', NOW(), NOW() + INTERVAL '7 days', 'GLOBAL'),
('Giảm 15% chi nhánh Hà Nội', 'Khuyến mãi riêng cho chi nhánh Hà Nội', 'DISCOUNT', 15, 'PERCENT', NOW(), NOW() + INTERVAL '10 days', 'BRANCH'),
('Combo 2 áo thun giá 399K', 'Mua 2 áo bất kỳ giá 399K', 'COMBO', 399000, 'FIXED', NOW(), NOW() + INTERVAL '14 days', 'GLOBAL'),
('Giảm 5% cho khách hàng VIP', 'Ưu đãi riêng cho nhóm VIP', 'DISCOUNT', 5, 'PERCENT', NOW(), NOW() + INTERVAL '30 days', 'CUSTOMER_GROUP');

-- Ví dụ: chi nhánh Hà Nội có id = 1, nhóm VIP có id = 2
INSERT INTO promotion_branches ("promotionId", "branchId") VALUES (2, 1);
INSERT INTO promotion_customer_groups ("promotionId", "customerGroupId") VALUES (4, 2);


