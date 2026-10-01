const path = require('path');
const fs = require('fs');

// Identificar si la aplicación se ejecuta dentro de un ejecutable empaquetado (pkg)
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg 
    ? path.dirname(process.execPath)
    : path.resolve(__dirname, '..');

const dataDir = path.resolve(baseDir, 'datos_negocio');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Auto-migración transparente: Si la base de datos estaba en la ruta anterior, moverla a datos_negocio/
const oldDbPath = path.resolve(baseDir, 'database.sqlite');
const dbPath = path.resolve(dataDir, 'database.sqlite');

if (!fs.existsSync(dbPath) && fs.existsSync(oldDbPath)) {
    console.log('🔄 Migrando base de datos existente a datos_negocio/...');
    try {
        fs.renameSync(oldDbPath, dbPath);
        if (fs.existsSync(oldDbPath + '-wal')) fs.renameSync(oldDbPath + '-wal', dbPath + '-wal');
        if (fs.existsSync(oldDbPath + '-shm')) fs.renameSync(oldDbPath + '-shm', dbPath + '-shm');
        console.log('✅ Base de datos migrada a datos_negocio exitosamente.');
    } catch (err) {
        console.error('⚠️ Error al auto-migrar base de datos:', err);
    }
}

// Truco de require dinámico para evitar que el empaquetador pkg analice estáticamente la dependencia 'node:sqlite'
const sqliteModule = 'node:sqlite';
const { DatabaseSync } = require(sqliteModule);
const db = new DatabaseSync(dbPath);

// Crear esquemas de base de datos para la tienda
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,        -- Precio de venta
    cost_price REAL DEFAULT 0,  -- Precio de costo para utilidad neta
    category TEXT,
    barcode TEXT UNIQUE,        -- Código de barras EAN-13 u otros
    stock INTEGER DEFAULT 0,    -- Inventario disponible
    min_stock INTEGER DEFAULT 5, -- Nivel mínimo para alertas críticas
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL NOT NULL,
    cost_total REAL DEFAULT 0,          -- Costo total de mercancía vendida
    payment_method TEXT NOT NULL,       -- 'Efectivo', 'Transferencia' o 'Fiado'
    payment_status TEXT DEFAULT 'paid', -- 'paid' (pagado) o 'pending' (deuda por pagar)
    customer_name TEXT,                  -- Nombre del vecino que debe (para fiados)
    shift_id INTEGER,                    -- Turno en el que se CREÓ la venta
    payment_shift_id INTEGER,            -- Turno en el que se PAGÓ la venta (importante para fiados cobrados después)
    status TEXT DEFAULT 'completed',     -- 'completed' o 'cancelled' (anulado)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    cost_price REAL DEFAULT 0,  -- Costo al momento de la venta
    quantity INTEGER NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  );

  CREATE TABLE IF NOT EXISTS active_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS account_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    cost_price REAL DEFAULT 0,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES active_accounts(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    initial_cash REAL DEFAULT 0,
    expected_cash REAL,
    final_cash REAL,
    discrepancy REAL,
    status TEXT DEFAULT 'open',
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    role TEXT DEFAULT 'cashier',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    due_date DATE NOT NULL,
    due_time TEXT DEFAULT NULL,
    advance_notice_days INTEGER DEFAULT 1,
    recurrence_days INTEGER DEFAULT 0,
    last_notified_at DATETIME DEFAULT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    cost REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
  CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
  CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id ON inventory_batches(product_id);
  CREATE INDEX IF NOT EXISTS idx_account_items_account_id ON account_items(account_id);
`);

// ============================================================
// MIGRACIONES UNIVERSALES Y EN CALIENTE PARA BASES DE DATOS HEREDADAS
// ============================================================
function safeAlter(sql) {
  try {
    db.exec(sql);
  } catch (e) {
    // Columna ya existe o ya fue alterada
  }
}

// 1. Tabla SALES
safeAlter("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed'");
safeAlter("ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'paid'");
safeAlter("ALTER TABLE sales ADD COLUMN customer_name TEXT DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN customer_id INTEGER DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN shift_id INTEGER DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN payment_shift_id INTEGER DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN parent_sale_id INTEGER DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN cost_total REAL DEFAULT 0");
safeAlter("ALTER TABLE sales ADD COLUMN cash_amount REAL DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN transfer_amount REAL DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN paid_at DATETIME DEFAULT NULL");
safeAlter("ALTER TABLE sales ADD COLUMN refunded_amount REAL DEFAULT 0");
safeAlter("ALTER TABLE sales ADD COLUMN business_line_id INTEGER DEFAULT 1");
safeAlter("ALTER TABLE sales ADD COLUMN notes TEXT DEFAULT NULL");

// 2. Tabla SHIFTS
safeAlter("ALTER TABLE shifts ADD COLUMN user_name TEXT DEFAULT 'Cajero'");
safeAlter("ALTER TABLE shifts ADD COLUMN status TEXT DEFAULT 'closed'");
safeAlter("ALTER TABLE shifts ADD COLUMN initial_cash REAL DEFAULT 0");
safeAlter("ALTER TABLE shifts ADD COLUMN expected_cash REAL DEFAULT NULL");
safeAlter("ALTER TABLE shifts ADD COLUMN final_cash REAL DEFAULT NULL");
safeAlter("ALTER TABLE shifts ADD COLUMN discrepancy REAL DEFAULT NULL");
safeAlter("ALTER TABLE shifts ADD COLUMN notes TEXT DEFAULT NULL");

// 3. Tabla EXPENSES
safeAlter("ALTER TABLE expenses ADD COLUMN shift_id INTEGER DEFAULT NULL");
safeAlter("ALTER TABLE expenses ADD COLUMN receipt_image TEXT DEFAULT NULL");
safeAlter("ALTER TABLE expenses ADD COLUMN payment_method TEXT DEFAULT 'Efectivo'");

// 4. Tabla PRODUCTS
safeAlter("ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0");
safeAlter("ALTER TABLE products ADD COLUMN image_path TEXT DEFAULT NULL");
safeAlter("ALTER TABLE products ADD COLUMN location TEXT DEFAULT NULL");
safeAlter("ALTER TABLE products ADD COLUMN unit_type TEXT DEFAULT 'unit'");
safeAlter("ALTER TABLE products ADD COLUMN description TEXT DEFAULT NULL");
safeAlter("ALTER TABLE products ADD COLUMN business_line TEXT DEFAULT NULL");
safeAlter("ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5");
safeAlter("ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0");
safeAlter("ALTER TABLE products ADD COLUMN barcode TEXT DEFAULT NULL");

// 5. Tabla SALE_ITEMS
safeAlter("ALTER TABLE sale_items ADD COLUMN original_price REAL DEFAULT NULL");
safeAlter("ALTER TABLE sale_items ADD COLUMN business_line TEXT DEFAULT NULL");
safeAlter("ALTER TABLE sale_items ADD COLUMN refunded_quantity REAL DEFAULT 0");
safeAlter("ALTER TABLE sale_items ADD COLUMN cost_price REAL DEFAULT 0");

// 6. Tabla ACCOUNT_ITEMS
safeAlter("ALTER TABLE account_items ADD COLUMN original_price REAL DEFAULT NULL");
safeAlter("ALTER TABLE account_items ADD COLUMN cost_price REAL DEFAULT 0");
safeAlter("ALTER TABLE account_items ADD COLUMN added_at TEXT DEFAULT NULL");
safeAlter("ALTER TABLE account_items ADD COLUMN round_num INTEGER DEFAULT 1");
safeAlter("ALTER TABLE account_items ADD COLUMN is_confirmed INTEGER DEFAULT 1");

// 6.5. Tabla REMINDERS
safeAlter("ALTER TABLE reminders ADD COLUMN customer_phone TEXT DEFAULT NULL");
safeAlter("ALTER TABLE reminders ADD COLUMN due_time TEXT DEFAULT NULL");
safeAlter("ALTER TABLE reminders ADD COLUMN advance_notice_days INTEGER DEFAULT 1");
safeAlter("ALTER TABLE reminders ADD COLUMN recurrence_days INTEGER DEFAULT 0");
safeAlter("ALTER TABLE reminders ADD COLUMN last_notified_at DATETIME DEFAULT NULL");
safeAlter("ALTER TABLE reminders ADD COLUMN time_alert_sent INTEGER DEFAULT 0");

// 7. PARCHES DE NORMALIZACIÓN DE DATOS HEREDADOS (Compatibilidad histórica automática)
try {
  db.exec("UPDATE sales SET status = 'completed' WHERE status IS NULL OR status = ''");
  db.exec("UPDATE sales SET payment_status = CASE WHEN payment_method = 'Fiado' THEN 'pending' ELSE 'paid' END WHERE payment_status IS NULL OR payment_status = ''");
  db.exec("UPDATE sales SET cash_amount = total WHERE cash_amount IS NULL AND payment_method = 'Efectivo'");
  db.exec("UPDATE sales SET transfer_amount = total WHERE transfer_amount IS NULL AND payment_method = 'Transferencia'");
  db.exec("UPDATE sales SET refunded_amount = 0 WHERE refunded_amount IS NULL");
  db.exec("UPDATE sales SET cost_total = 0 WHERE cost_total IS NULL");
} catch (e) {}

try {
  db.exec("UPDATE sales SET customer_name = fiado_note WHERE (customer_name IS NULL OR customer_name = '') AND fiado_note IS NOT NULL");
} catch (e) {}

try {
  db.exec("UPDATE shifts SET status = CASE WHEN end_time IS NULL THEN 'open' ELSE 'closed' END WHERE status IS NULL OR status = ''");
  db.exec("UPDATE shifts SET initial_cash = 0 WHERE initial_cash IS NULL");
} catch (e) {}

try {
  db.exec("UPDATE shifts SET user_name = responsible_name WHERE (user_name IS NULL OR user_name = 'Cajero') AND responsible_name IS NOT NULL");
} catch (e) {}
try {
  db.exec("UPDATE shifts SET final_cash = cash_counted WHERE final_cash IS NULL AND cash_counted IS NOT NULL");
} catch (e) {}
try {
  db.exec("UPDATE shifts SET expected_cash = cash_expected WHERE expected_cash IS NULL AND cash_expected IS NOT NULL");
} catch (e) {}
try {
  db.exec("UPDATE shifts SET discrepancy = cash_difference WHERE discrepancy IS NULL AND cash_difference IS NOT NULL");
} catch (e) {}
try {
  db.exec("UPDATE expenses SET receipt_image = invoice_image_path WHERE receipt_image IS NULL AND invoice_image_path IS NOT NULL");
} catch (e) {}
try {
  db.exec("UPDATE products SET cost_price = 0 WHERE cost_price IS NULL");
  db.exec("UPDATE products SET stock = 0 WHERE stock IS NULL");
  db.exec("UPDATE products SET min_stock = 5 WHERE min_stock IS NULL");
  db.exec("UPDATE products SET unit_type = 'unit' WHERE unit_type IS NULL OR unit_type = ''");
  db.exec("UPDATE sale_items SET refunded_quantity = 0 WHERE refunded_quantity IS NULL");
  db.exec("UPDATE sale_items SET cost_price = 0 WHERE cost_price IS NULL");
} catch (e) {}

// REFUNDS & DEVOLUCIONES INTELIGENTES
db.exec(`
  CREATE TABLE IF NOT EXISTS sale_refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    refund_amount REAL NOT NULL,
    refund_type TEXT NOT NULL, -- 'total' o 'partial'
    payment_method TEXT NOT NULL,
    reason TEXT,
    returned_to_stock INTEGER DEFAULT 1,
    user_name TEXT,
    shift_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  );

  CREATE TABLE IF NOT EXISTS sale_refund_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_id INTEGER NOT NULL,
    sale_item_id INTEGER,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (refund_id) REFERENCES sale_refunds(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale_id ON sale_refunds(sale_id);
`);

// Configuración inicial por defecto si está vacía
const configCount = db.prepare('SELECT count(*) as count FROM config').get();
if (configCount.count === 0) {
  const insertConfig = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)');
  insertConfig.run('business_name', 'Mi Tiendita de Barrio');
  insertConfig.run('business_nit', '123456789-0');
  insertConfig.run('business_address', 'Calle Central # 45 - 12');
  insertConfig.run('business_phone', '300 123 4567');
  insertConfig.run('footer_message', '¡Muchas gracias por su compra! Vuelva pronto.');
  insertConfig.run('theme_color', 'Azul Galáctico'); // Default theme
  insertConfig.run('theme_mode', 'dark'); // Default mode
}

// Ensure admin_password exists for older databases
const adminPasswordCheck = db.prepare("SELECT * FROM config WHERE key = 'admin_password'").get();
let adminPin = '1234';
if (!adminPasswordCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('admin_password', '1234')").run();
} else {
  adminPin = adminPasswordCheck.value;
}

// Ensure default admin user exists
const adminUserCheck = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminUserCheck) {
  db.prepare("INSERT INTO users (username, pin, role) VALUES ('admin', ?, 'admin')").run(adminPin);
}

// Ensure enable_fifo config exists
const fifoCheck = db.prepare("SELECT * FROM config WHERE key = 'enable_fifo'").get();
if (!fifoCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('enable_fifo', 'false')").run();
}

// Ensure strict_inventory config exists
const strictInvCheck = db.prepare("SELECT * FROM config WHERE key = 'strict_inventory'").get();
if (!strictInvCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('strict_inventory', 'true')").run();
}

// Ensure business_lines config exists
const blCheck = db.prepare("SELECT * FROM config WHERE key = 'enable_business_lines'").get();
if (!blCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('enable_business_lines', 'false')").run();
  db.prepare("INSERT INTO config (key, value) VALUES ('business_line_1_name', 'Línea 1')").run();
  db.prepare("INSERT INTO config (key, value) VALUES ('business_line_2_name', 'Línea 2')").run();
}

// Ensure enable_reminders config exists
const remindersCheck = db.prepare("SELECT * FROM config WHERE key = 'enable_reminders'").get();
if (!remindersCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('enable_reminders', 'true')").run();
}
const tgRemindersCheck = db.prepare("SELECT * FROM config WHERE key = 'telegram_notify_reminders'").get();
if (!tgRemindersCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('telegram_notify_reminders', 'true')").run();
}

// Ensure print_mode config exists ('ask' | 'auto' | 'manual')
const printModeCheck = db.prepare("SELECT * FROM config WHERE key = 'print_mode'").get();
if (!printModeCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('print_mode', 'ask')").run();
}

// Ensure enable_tables_system exists ('true' | 'false')
const tablesSystemCheck = db.prepare("SELECT * FROM config WHERE key = 'enable_tables_system'").get();
if (!tablesSystemCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('enable_tables_system', 'true')").run();
}

// Ensure enable_rounds_system exists ('true' | 'false')
const roundsSystemCheck = db.prepare("SELECT * FROM config WHERE key = 'enable_rounds_system'").get();
if (!roundsSystemCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES ('enable_rounds_system', 'true')").run();
}

module.exports = db;
