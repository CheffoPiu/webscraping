# Instagram — scraping de perfil público

Proyecto académico: interfaz web + API Node (Express) + Playwright. Estrategia **anónima primero**, **cookies** como respaldo.

## Inicio rápido

```bash
npm install
npx playwright install chromium
npm start
```

- App: `http://localhost:3000`
- Documentación visual: `http://localhost:3000/docs.html`
- Sesión opcional: `npm run auth:setup` (genera `instagram-auth.json`; no subir a Git)

Copiá `.env.example` a `.env` si necesitás cambiar puerto o la ruta del archivo de sesión.

## Documentación en GitHub Pages

La carpeta `docs/` contiene la misma guía en `index.html` para publicarla como sitio estático: en el repo de GitHub, **Settings → Pages → Branch `main`, folder `/docs`**. La URL será `https://cheffopiu.github.io/webscraping/`.

Eso **no** ejecuta el scraping en la nube: solo muestra el manual. La app interactiva sigue siendo `npm start` en tu PC (o un deploy con Node + Playwright en otro proveedor).
