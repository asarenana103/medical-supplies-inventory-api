const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');

const schemaPath = path.resolve(process.cwd(), 'database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (error) => {
  if (error) {
    console.error('Failed to initialize database:', error.message);
    process.exitCode = 1;
  } else {
    console.log('Database initialized successfully.');
  }

  db.close();
});
