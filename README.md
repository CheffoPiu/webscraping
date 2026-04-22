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
