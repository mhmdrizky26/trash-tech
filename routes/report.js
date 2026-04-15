const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../config/db");
const uploadFile = require("../config/s3");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


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
        if (err) throw err;
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
    if (err) throw err;
    res.json(result);
  });
});


// ✅ UPDATE STATUS (ADMIN)
router.put("/:id", (req, res) => {
  const { status } = req.body;

  db.query(
    "UPDATE reports SET status=? WHERE id=?",
    [status, req.params.id],
    (err) => {
      if (err) throw err;
      res.send("Status diperbarui");
    }
  );
});

module.exports = router;