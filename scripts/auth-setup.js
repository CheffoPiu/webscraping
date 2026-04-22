/**
 * Abre Chromium para que inicies sesión manualmente en Instagram.
 * Al cerrar la ventana (o Ctrl+C en consola), guarda la sesión en instagram-auth.json
 *
 * Uso: npm run auth:setup
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const outFile =
  process.env.STORAGE_STATE_PATH ||
  path.join(process.cwd(), "instagram-auth.json");

async function main() {
  console.log("\n=== Configuración de cookies (storage state) ===\n");
  console.log("Se abrirá el navegador. Iniciá sesión en Instagram.");
  console.log("Cuando veas tu feed o el sitio cargado correctamente, volvé a esta consola y presioná ENTER.\n");
  console.log(`El archivo se guardará en: ${path.resolve(outFile)}\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: "es-ES",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "domcontentloaded",
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) =>
    rl.question("Presioná ENTER aquí cuando hayas iniciado sesión correctamente... ", () => {
      rl.close();
      resolve();
    })
  );

  await context.storageState({ path: outFile });
  await browser.close();

  if (fs.existsSync(outFile)) {
    console.log(`\nListo. Sesión guardada en ${path.resolve(outFile)}`);
    console.log("Agregá STORAGE_STATE_PATH en .env si usás otra ruta.\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
