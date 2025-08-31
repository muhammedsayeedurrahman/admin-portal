import fs from 'fs';
import path from 'path';
import db from '../src/config/db.js';

async function main() {
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), 'sql', 'schema.sql'), 'utf-8');
    await db.query(sql);
    console.log('Database initialized.');
    process.exit(0);
  } catch (e) {
    console.error('DB init failed:', e);
    process.exit(1);
  }
}

main();
