// db.js
const { Pool } = require('pg');
require('dotenv').config();


const pool = new Pool({
  host: 'localhost',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'pinterest',
  port: 5432
});

module.exports = pool;