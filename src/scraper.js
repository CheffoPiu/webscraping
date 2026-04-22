const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const IG_BASE = "https://www.instagram.com";

function normalizeUsername(input) {
  const u = String(input || "")
    .trim()
    .replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(u)) {
    throw new Error(
      "Usuario inválido: use solo letras, números, punto y guion bajo (máx. 30 caracteres)."
    );
  }
  return u;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function extractFromPage(page) {
  return page.evaluate(() => {
    const result = {
      fullName: null,
      biography: null,
      followersLabel: null,
      followingLabel: null,
      postsLabel: null,
      isPrivate: false,
      notAvailable: false,
      loginWall: false,
      postUrls: [],
      ogTitle: null,
      ogDescription: null,
      metaDescription: null,
    };

    const bodyText = document.body?.innerText || "";

    if (/This Account is Private|esta cuenta es privada|compte est privé/i.test(bodyText)) {
      result.isPrivate = true;
    }
    if (
      /Page Not Found|no está disponible|Sorry, this page isn't available|no encontramos/i.test(
        bodyText
      )
    ) {
      result.notAvailable = true;
    }
    if (
      /Log in to Instagram|Iniciar sesión|Connectez-vous|Log In/i.test(bodyText) &&
      document.querySelector('input[name="password"], input[type="password"]')
    ) {
      result.loginWall = true;
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (ogTitle) result.ogTitle = ogTitle.getAttribute("content");
    if (ogDesc) result.ogDescription = ogDesc.getAttribute("content");
    if (metaDesc) result.metaDescription = metaDesc.getAttribute("content");

    const header = document.querySelector("header");
    if (header) {
      const h1 = header.querySelector("h1");
      const h2 = header.querySelector("h2");
      const candidateName = h2?.innerText?.trim() || h1?.innerText?.trim();
      if (candidateName && !/^@\w/.test(candidateName)) {
        result.fullName = candidateName;
      }

      const spans = [...header.querySelectorAll("span")].map((s) => s.innerText.trim());
      const bioSpan = spans.find(
        (t) => t.length > 0 && t.length < 500 && !/^\d[\d.,]*\s*(followers|seguidores)/i.test(t)
      );
      if (bioSpan && !result.fullName) result.biography = bioSpan;
    }

    const main = document.querySelector("main");
    const root = main || document;
    const anchors = [
      ...root.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'),
    ];
    const seen = new Set();
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/\/(?:p|reel)\/([^/?#]+)/);
      if (!m) continue;
      const shortcode = m[1];
      if (seen.has(shortcode)) continue;
      seen.add(shortcode);
      const url = new URL(href, "https://www.instagram.com").href;
      result.postUrls.push(url);
    }

    const listItems = [...document.querySelectorAll("header li, header a span")];
    for (const el of listItems) {
      const t = el.innerText?.trim() || "";
      if (/seguidores|followers/i.test(t)) result.followersLabel = t;
      if (/seguidos|following/i.test(t)) result.followingLabel = t;
      if (/publicaciones|posts/i.test(t)) result.postsLabel = t;
    }

    if (!result.biography && result.metaDescription) {
      const parts = result.metaDescription.split(" - ");
      if (parts.length >= 2) {
        result.biography = parts.slice(1).join(" - ").trim() || null;
      }
    }

    return result;
  });
}

async function gentleScroll(page) {
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 900);
    await sleep(450 + Math.random() * 200);
  }
}

async function runOnce(username, options) {
  const {
    storageStatePath = null,
    minPosts = 10,
    modeLabel = "anonymous",
  } = options;

  const launchOptions = {
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  };

  const browser = await chromium.launch(launchOptions);
  const contextOptions = {
    locale: "es-ES",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  };
  if (storageStatePath && fs.existsSync(storageStatePath)) {
    contextOptions.storageState = path.resolve(storageStatePath);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  const profileUrl = `${IG_BASE}/${encodeURIComponent(username)}/`;

  try {
    await page.goto(profileUrl, { waitUntil: "domcontentloaded" });
    await sleep(1200 + Math.random() * 400);

    try {
      await page.waitForSelector("main", { timeout: 15000 });
    } catch {
      /* layout puede variar */
    }

    await gentleScroll(page);

    const raw = await extractFromPage(page);

    const posts = raw.postUrls.slice(0, Math.max(minPosts, 10));

    const result = {
      ok: true,
      username,
      profileUrl,
      mode: modeLabel,
      scrapedAt: new Date().toISOString(),
      profile: {
        fullName: raw.fullName,
        biography: raw.biography,
        followersLabel: raw.followersLabel,
        followingLabel: raw.followingLabel,
        postsLabel: raw.postsLabel,
        ogTitle: raw.ogTitle,
        ogDescription: raw.ogDescription,
        metaDescription: raw.metaDescription,
      },
      flags: {
        isPrivate: raw.isPrivate,
        notAvailable: raw.notAvailable,
        loginWall: raw.loginWall,
      },
      posts,
      stats: {
        requestedMinPosts: minPosts,
        collectedPosts: posts.length,
      },
    };

    if (raw.notAvailable) {
      result.ok = false;
      result.error = {
        code: "NOT_FOUND",
        message: "El perfil no existe o no está disponible.",
      };
    } else if (raw.isPrivate) {
      result.ok = false;
      result.error = {
        code: "PRIVATE",
        message: "La cuenta es privada; no se puede leer la rejilla sin permisos adecuados.",
      };
    } else if (raw.loginWall && posts.length === 0) {
      result.ok = false;
      result.error = {
        code: "LOGIN_WALL",
        message:
          "Instagram solicitó inicio de sesión o bloqueó la vista; probá de nuevo con cookies (npm run auth:setup).",
      };
    } else {
      if (posts.length < minPosts) {
        result.warning = {
          code: "FEW_POSTS",
          message: `Se recolectaron ${posts.length} publicación(es); el objetivo era al menos ${minPosts} (perfil con pocas publicaciones o cambio en la página).`,
        };
      }
      if (posts.length === 0 && !raw.loginWall) {
        result.warning = {
          code: "NO_POSTS",
          message:
            "No se detectaron enlaces de publicaciones en la rejilla; puede ser cuenta nueva o estructura distinta.",
        };
      }
    }

    return result;
  } finally {
    await browser.close();
  }
}

async function scrapeProfile(usernameInput, opts = {}) {
  const username = normalizeUsername(usernameInput);
  const minPosts = Math.min(Math.max(Number(opts.minPosts) || 10, 1), 30);
  const storagePath =
    opts.storageStatePath ||
    process.env.STORAGE_STATE_PATH ||
    path.join(process.cwd(), "instagram-auth.json");

  const anonymous = await runOnce(username, {
    storageStatePath: null,
    minPosts,
    modeLabel: "anonymous",
  });

  const needRetry =
    !anonymous.ok && anonymous.error?.code === "LOGIN_WALL";

  const hasStorage = storagePath && fs.existsSync(storagePath);

  if (needRetry && hasStorage) {
    const withCookies = await runOnce(username, {
      storageStatePath: storagePath,
      minPosts,
      modeLabel: "cookies",
    });
    withCookies.fallbackFrom = "anonymous";
    return withCookies;
  }

  if (needRetry && !hasStorage) {
    anonymous.hint =
      "Configurá STORAGE_STATE_PATH y ejecutá npm run auth:setup para generar instagram-auth.json.";
  }

  return anonymous;
}

module.exports = {
  scrapeProfile,
  normalizeUsername,
};
