require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { scrapeProfile, normalizeUsername } = require("./scraper");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/data", express.static(path.join(__dirname, "..", "data")));

app.post("/api/scrape", async (req, res) => {
  try {
    const { username, minPosts, fetchMedia, maxMediaFetch } = req.body || {};
    if (!username || typeof username !== "string") {
      return res.status(400).json({
        ok: false,
        error: { code: "BAD_REQUEST", message: "Falta el campo username." },
      });
    }
    const data = await scrapeProfile(username, {
      minPosts,
      fetchMedia: Boolean(fetchMedia),
      maxMediaFetch,
    });
    const status = data.ok ? 200 : 422;
    return res.status(status).json(data);
  } catch (err) {
    const message = err?.message || "Error interno";
    const isValidation = /inválido/i.test(message);
    return res.status(isValidation ? 400 : 500).json({
      ok: false,
      error: { code: isValidation ? "VALIDATION" : "INTERNAL", message },
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "instagram-public-scraper" });
});

app.get("/api/validate-username", (req, res) => {
  const q = req.query.u || req.query.username;
  try {
    const u = normalizeUsername(q);
    return res.json({ ok: true, username: u });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: { message: err.message },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`Documentación: http://localhost:${PORT}/docs.html`);
});
