// db.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pinterest',
  password: 'your_password', // Replace with your actual password
  port: 5432,
});

module.exports = pool;