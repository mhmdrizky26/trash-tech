require("dotenv").config();
const mysql = require("mysql2");

const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 10);
const heartbeatMs = Number(process.env.DB_HEARTBEAT_INTERVAL_MS || 60000);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("DB ERROR:", err);
  } else {
    console.log("MySQL Pool Connected");
    connection.release();
  }
});

db.on("error", (err) => {
  console.error("MySQL Pool Error:", err);
});

db.on("connection", (connection) => {
  connection.on("error", (err) => {
    console.error("MySQL Connection Error:", err.code || err.message);
  });
});

if (heartbeatMs > 0) {
  const heartbeat = setInterval(() => {
    db.query("SELECT 1", (err) => {
      if (err) {
        console.error("MySQL Heartbeat Error:", err.code || err.message);
      }
    });
  }, heartbeatMs);

  heartbeat.unref();
}

module.exports = db;