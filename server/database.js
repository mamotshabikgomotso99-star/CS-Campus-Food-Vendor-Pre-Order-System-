const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const MIGRATIONS = ['001_initial_schema.sql', '002_menu_item_images.sql'];

const seedVendors = [
  { id: 'fresh-bites', name: 'Fresh Bites', category: 'Fast Food' },
  { id: 'mamas-corner', name: "Mama's Corner", category: 'Traditional Meals' },
  { id: 'student-cafe', name: 'Student Café', category: 'Campus Café' },
  { id: 'sunset-snacks', name: 'Sunset Snacks', category: 'Snacks' },
];

const seedMenuItems = [
  { id: 'chicken-wrap', vendorId: 'fresh-bites', name: 'Chicken Wrap', priceCents: 4500, category: 'Meals', description: 'Grilled chicken, crunchy slaw, and chilli mayo.' },
  { id: 'pap-chakalaka', vendorId: 'fresh-bites', name: 'Pap & Chakalaka', priceCents: 4800, category: 'African Meals', description: 'Soft maize pap served with spicy chakalaka relish.' },
  { id: 'vetkoek-mince', vendorId: 'fresh-bites', name: 'Vetkoek & Mince', priceCents: 4200, category: 'Street Food', description: 'Golden fried dough filled with savoury spiced mince.' },
  { id: 'peri-peri-chicken', vendorId: 'fresh-bites', name: 'Peri-Peri Chicken Plate', priceCents: 6500, category: 'African Meals', description: 'Chargrilled chicken with peri-peri sauce and seasoned sides.' },
  { id: 'chicken-livers-pap', vendorId: 'fresh-bites', name: 'Chicken Livers & Pap', priceCents: 5000, category: 'African Meals', description: 'Tender spicy chicken livers with creamy maize pap.' },
  { id: 'veggie-wrap', vendorId: 'fresh-bites', name: 'Veggie Wrap', priceCents: 3800, category: 'Meals', description: 'Fresh vegetables with a light herb dressing.' },
  { id: 'beef-bowl', vendorId: 'mamas-corner', name: 'Beef Rice Bowl', priceCents: 6200, category: 'Meals', description: 'Tender beef, rice, and seasonal vegetables.' },
  { id: 'miso-noodle', vendorId: 'mamas-corner', name: 'Miso Noodle Cup', priceCents: 5200, category: 'Meals', description: 'Comforting noodles in a rich miso broth.' },
  { id: 'beef-bunny-chow', vendorId: 'mamas-corner', name: 'Beef Bunny Chow', priceCents: 5800, category: 'African Meals', description: 'Durban-style curry served inside a fresh quarter loaf.' },
  { id: 'chicken-samoosa', vendorId: 'mamas-corner', name: 'Chicken Samoosas', priceCents: 3000, category: 'Snacks', description: 'Crisp pastry triangles filled with spiced chicken.' },
  { id: 'lamb-bunny-chow', vendorId: 'mamas-corner', name: 'Lamb Bunny Chow', priceCents: 6800, category: 'African Meals', description: 'Slow-cooked lamb curry served in a fresh bread loaf.' },
  { id: 'samp-beans', vendorId: 'mamas-corner', name: 'Samp & Beans Bowl', priceCents: 5200, category: 'African Meals', description: 'Comforting samp and beans finished with a savoury relish.' },
  { id: 'iced-latte', vendorId: 'student-cafe', name: 'Iced Latte', priceCents: 2800, category: 'Drinks', description: 'Smooth and chilled for busy campus hours.' },
  { id: 'cheese-scone', vendorId: 'student-cafe', name: 'Cheese Scone', priceCents: 2200, category: 'Snacks', description: 'Warm, flaky, and easy to grab on the move.', available: false },
  { id: 'rooibos-iced-tea', vendorId: 'student-cafe', name: 'Iced Rooibos Tea', priceCents: 2400, category: 'Traditional Drinks', description: 'Chilled South African rooibos tea with citrus.' },
  { id: 'malva-pudding', vendorId: 'student-cafe', name: 'Malva Pudding', priceCents: 3500, category: 'Desserts', description: 'Warm apricot sponge with a sweet custard pour.' },
  { id: 'amagwinya-bites-cafe', vendorId: 'student-cafe', name: 'Amagwinya Bites', priceCents: 2600, category: 'Snacks', description: 'Mini vetkoek served warm with a sweet chilli dip.' },
  { id: 'koeksister', vendorId: 'student-cafe', name: 'Cape Koeksister', priceCents: 2000, category: 'Desserts', description: 'Traditional syrup-soaked twisted dough with coconut.' },
  { id: 'fruit-smoothie', vendorId: 'sunset-snacks', name: 'Fruit Smoothie', priceCents: 3000, category: 'Drinks', description: 'Refreshing fruit blend for a quick boost.' },
  { id: 'boerewors-roll', vendorId: 'sunset-snacks', name: 'Boerewors Roll', priceCents: 4600, category: 'Street Food', description: 'Grilled boerewors in a soft roll with tomato relish.' },
  { id: 'amagwinya', vendorId: 'sunset-snacks', name: 'Amagwinya Bites', priceCents: 2600, category: 'Snacks', description: 'Mini vetkoek bites served with a sweet chilli dip.' },
  { id: 'mango-smoothie', vendorId: 'sunset-snacks', name: 'Mango Smoothie', priceCents: 3500, category: 'Smoothies', description: 'Creamy mango blended with yoghurt and a touch of citrus.' },
  { id: 'berry-smoothie', vendorId: 'sunset-snacks', name: 'Berry Smoothie', priceCents: 3800, category: 'Smoothies', description: 'A chilled blend of berries, banana, and yoghurt.' },
  { id: 'kota-quarter', vendorId: 'sunset-snacks', name: 'Kota Quarter', priceCents: 5500, category: 'Street Food', description: 'A loaded quarter loaf with chips, egg, and spicy relish.' },
  { id: 'mahewu-drink', vendorId: 'sunset-snacks', name: 'Mahewu Cooler', priceCents: 2200, category: 'Traditional Drinks', description: 'A chilled, lightly sweet fermented maize drink.' },
];

async function ensureCollectionSlots(pool, vendorId) {
  const vendors = vendorId
    ? await pool.query('SELECT id FROM vendors WHERE id = $1', [vendorId])
    : await pool.query('SELECT id FROM vendors');
  const vendorIds = [];
  const startsAtValues = [];
  const now = Date.now();

  for (const vendor of vendors.rows) {
    for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() + dayOffset);
      day.setUTCHours(0, 0, 0, 0);

      for (let minuteOfDay = 8 * 60; minuteOfDay <= 16 * 60; minuteOfDay += 30) {
        const startsAt = new Date(day.getTime() + minuteOfDay * 60_000);
        if (startsAt.getTime() > now) {
          vendorIds.push(vendor.id);
          startsAtValues.push(startsAt.toISOString());
        }
      }
    }
  }

  if (vendorIds.length > 0) {
    await pool.query(
      `INSERT INTO collection_slots (id, vendor_id, starts_at, capacity)
       SELECT gen_random_uuid(), slot_data.vendor_id, slot_data.starts_at, 10
         FROM UNNEST($1::text[], $2::timestamptz[]) AS slot_data(vendor_id, starts_at)
       ON CONFLICT (vendor_id, starts_at) DO NOTHING`,
      [vendorIds, startsAtValues],
    );
  }
}

function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to start the Campus Eats API.');
  }

  return new Pool({ connectionString, max: 10 });
}

async function applyMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
    for (const migration of MIGRATIONS) {
      const result = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [migration]);
      if (result.rowCount === 0) {
        const migrationPath = path.join(__dirname, 'migrations', migration);
        await client.query(fs.readFileSync(migrationPath, 'utf8'));
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function initializeDatabase(pool) {
  await applyMigrations(pool);

  await pool.query(
    `INSERT INTO vendors (id, name, category)
     SELECT seed.id, seed.name, seed.category
       FROM UNNEST($1::text[], $2::text[], $3::text[]) AS seed(id, name, category)
     ON CONFLICT (id) DO NOTHING`,
    [seedVendors.map((vendor) => vendor.id), seedVendors.map((vendor) => vendor.name), seedVendors.map((vendor) => vendor.category)],
  );

  await pool.query(
    `INSERT INTO menu_items (id, vendor_id, name, price_cents, category, description, available)
     SELECT seed.id, seed.vendor_id, seed.name, seed.price_cents, seed.category, seed.description, seed.available
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::integer[], $5::text[], $6::text[], $7::boolean[])
            AS seed(id, vendor_id, name, price_cents, category, description, available)
     ON CONFLICT (id) DO NOTHING`,
    [
      seedMenuItems.map((item) => item.id),
      seedMenuItems.map((item) => item.vendorId),
      seedMenuItems.map((item) => item.name),
      seedMenuItems.map((item) => item.priceCents),
      seedMenuItems.map((item) => item.category),
      seedMenuItems.map((item) => item.description),
      seedMenuItems.map((item) => item.available !== false),
    ],
  );

  await ensureCollectionSlots(pool);
}

module.exports = { createPool, ensureCollectionSlots, initializeDatabase };