const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbFile = process.env.DB_FILE || 'database/msi.sqlite';
const dbPath = path.resolve(process.cwd(), dbFile);

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error('Failed to connect to SQLite database:', error.message);
    process.exit(1);
  }
});

db.run('PRAGMA foreign_keys = ON');

module.exports = db;
