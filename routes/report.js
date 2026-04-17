const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../config/db");
const uploadFile = require("../config/s3");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}


// ✅ CREATE REPORT (UPLOAD S3)
router.post("/", upload.single("foto"), async (req, res) => {
  try {
    const { lokasi, deskripsi } = req.body;

    let foto_url = null;

    if (req.file) {
      const result = await uploadFile(req.file);
      foto_url = result.Location;
    }

    db.query(
      "INSERT INTO reports (lokasi, deskripsi, foto_url) VALUES (?, ?, ?)",
      [lokasi, deskripsi, foto_url],
      (err) => {
        if (err) {
          return res.status(500).json({ message: "Gagal menyimpan laporan", error: err.message });
        }
        res.json({ message: "Laporan berhasil dikirim" });
      }
    );
  } catch (err) {
    res.status(500).send(err.message);
  }
});


// ✅ GET ALL REPORTS
router.get("/", (req, res) => {
  db.query("SELECT * FROM reports ORDER BY created_at DESC", (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Gagal mengambil laporan", error: err.message });
    }
    res.json(result);
  });
});

// ✅ GET ANALYTICS (HOMEPAGE + ADMIN CHARTS)
router.get("/analytics", async (req, res) => {
  try {
    const [summaryRows, statusRows, dailyRows, topLocationRows] = await Promise.all([
      runQuery(
        `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN LOWER(COALESCE(status, 'menunggu')) = 'menunggu' THEN 1 ELSE 0 END) AS menunggu,
            SUM(CASE WHEN LOWER(COALESCE(status, 'menunggu')) = 'diproses' THEN 1 ELSE 0 END) AS diproses,
            SUM(CASE WHEN LOWER(COALESCE(status, 'menunggu')) = 'selesai' THEN 1 ELSE 0 END) AS selesai
          FROM reports
        `
      ),
      runQuery(
        `
          SELECT LOWER(COALESCE(status, 'menunggu')) AS status, COUNT(*) AS total
          FROM reports
          GROUP BY LOWER(COALESCE(status, 'menunggu'))
        `
      ),
      runQuery(
        `
          SELECT DATE(created_at) AS day, COUNT(*) AS total
          FROM reports
          WHERE created_at IS NOT NULL
            AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at)
        `
      ),
      runQuery(
        `
          SELECT lokasi, COUNT(*) AS total
          FROM reports
          WHERE lokasi IS NOT NULL AND TRIM(lokasi) <> ''
          GROUP BY lokasi
          ORDER BY total DESC, lokasi ASC
          LIMIT 5
        `
      )
    ]);

    const summary = summaryRows[0] || { total: 0, menunggu: 0, diproses: 0, selesai: 0 };
    const total = Number(summary.total || 0);
    const menunggu = Number(summary.menunggu || 0);
    const diproses = Number(summary.diproses || 0);
    const selesai = Number(summary.selesai || 0);
    const responseRate = total ? Math.round((selesai / total) * 100) : 0;

    const statusBreakdown = {
      menunggu: 0,
      diproses: 0,
      selesai: 0
    };

    statusRows.forEach((row) => {
      const key = (row.status || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(statusBreakdown, key)) {
        statusBreakdown[key] = Number(row.total || 0);
      }
    });

    const dayMap = {};
    dailyRows.forEach((row) => {
      if (!row.day) return;
      const key = new Date(row.day).toISOString().slice(0, 10);
      dayMap[key] = Number(row.total || 0);
    });

    const dailyTrend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyTrend.push({
        day: key,
        total: dayMap[key] || 0
      });
    }

    const topLocations = topLocationRows.map((row) => ({
      lokasi: row.lokasi,
      total: Number(row.total || 0)
    }));

    res.json({
      summary: {
        total,
        menunggu,
        diproses,
        selesai,
        responseRate
      },
      statusBreakdown,
      dailyTrend,
      topLocations
    });
  } catch (err) {
    res.status(500).json({ message: "Gagal memuat analytics", error: err.message });
  }
});


// ✅ UPDATE STATUS (ADMIN)
router.put("/:id", (req, res) => {
  const { status } = req.body;

  db.query(
    "UPDATE reports SET status=? WHERE id=?",
    [status, req.params.id],
    (err) => {
      if (err) {
        return res.status(500).json({ message: "Gagal memperbarui status", error: err.message });
      }
      res.send("Status diperbarui");
    }
  );
});

module.exports = router;