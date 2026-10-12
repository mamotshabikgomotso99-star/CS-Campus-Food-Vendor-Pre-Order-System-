const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { createPool } = require('../database');
const { createVendorLogin } = require('../vendor-provisioning');

const envPath = path.join(__dirname, '..', '.env');
if (process.loadEnvFile && fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function ask(question) {
  const terminal = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await terminal.question(question)).trim();
  } finally {
    terminal.close();
  }
}

function askHidden(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal to enter passwords securely.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (input) => {
      for (const character of input.toString('utf8')) {
        if (character === '\u0003') {
          finish(new Error('Vendor login setup cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function provisionOne(pool) {
  const result = await pool.query(
    'SELECT id, name FROM vendors WHERE owner_user_id IS NULL ORDER BY name',
  );
  if (result.rows.length === 0) {
    stdout.write('All vendor profiles already have login accounts.\n');
    return false;
  }

  stdout.write('\nUnlinked vendor profiles:\n');
  result.rows.forEach((vendor, index) => {
    stdout.write(`${index + 1}. ${vendor.name} (${vendor.id})\n`);
  });

  const selection = Number(await ask('Choose a vendor number: '));
  const vendor = result.rows[selection - 1];
  if (!vendor) {
    throw new Error('Choose a number from the vendor list.');
  }

  const fullName = await ask('Account holder full name: ');
  const email = await ask('Vendor login email: ');
  const password = await askHidden('Initial password (12+ characters, input hidden): ');
  const confirmPassword = await askHidden('Confirm initial password (input hidden): ');
  if (password !== confirmPassword) {
    throw new Error('Passwords do not match. No account was created.');
  }

  await createVendorLogin(pool, { vendorId: vendor.id, fullName, email, password });
  stdout.write(`Vendor login created for ${vendor.name}.\n`);
  return true;
}

async function main() {
  const pool = createPool();
  try {
    while (await provisionOne(pool)) {
      const another = (await ask('Create another vendor login? (y/N): ')).toLowerCase();
      if (another !== 'y') break;
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || 'Unable to create the vendor login.');
    process.exitCode = 1;
  });
}

module.exports = { askHidden, main, provisionOne };