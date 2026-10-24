# BioMedGest

Aplicación web de gestión de equipamiento médico, creada con React, TypeScript, Tailwind CSS 4 y Vite.

## Ejecutar localmente

Se recomienda Node.js 22 o superior y pnpm 10.

```bash
corepack enable
pnpm install
pnpm dev
```

Para generar la versión de producción:

```bash
pnpm build
pnpm preview
```

La aplicación incluye un manifiesto web y un service worker para uso como PWA.

> La página conserva `noindex, nofollow`, ya que así estaba configurada en el proyecto de origen. Si se publica como sitio público, revisa esta opción en `index.html`.
