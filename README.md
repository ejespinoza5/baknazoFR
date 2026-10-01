# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

---

## Rutas y enlaces compartibles

La navegación usa React Router, así que **la URL es el estado de la pantalla**.
`/anuncio/123` es la ruta compartible de una publicación: al abrirla entra
directo a esa ficha, y al recargar se sigue viendo. `/perfil/7` funciona igual
con el perfil de quien publicó.

### El perfil todavía no pide nada a la API

La pantalla de perfil está maquetada con datos de ejemplo en
`src/screens/perfil/datos.ts`. Cuando exista el endpoint, se borra ese archivo y
`PerfilScreen` se pinta contra la respuesta real; los tipos que necesita ya están
en `src/types/perfil.ts`.

El anuncio desde el que se entra viaja en el `state` del router, no en la URL, y
por eso el perfil muestra ese anuncio con sus datos reales de primero. Al
compartir el enlace o recargar se pierden y quedan los anuncios de ejemplo: es
lo único que se pierde, y meter un título en la ruta lo convertiría en un 404.

La clave de la URL es `autor.id`, el id de la **cuenta**, que es lo que debería
mandar el backend. Como la API en producción todavía no lo manda, mientras tanto
se usa el id del anuncio, que produce un perfil coherente en vez de un enlace
muerto. En cuanto el servidor envíe `autor.id` —una línea en `autorDe()` de
`src/services/anuncioService.js`— el respaldo deja de usarse solo.

### El servidor debe devolver index.html

Como las rutas son reales, el servidor web tiene que reescribir cualquier ruta
desconocida al `index.html`. Sin esto, `/anuncio/123` responde 404 al compartir
el enlace, aunque la app funcione bien en desarrollo.

Ya se incluye `public/_redirects` para Netlify y Vercel. Para **nginx**:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Para **Apache** (en `.htaccess`):

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Para probarlo en local sin construir, Vite ya lo hace: `npm run dev` resuelve
cualquier ruta al `index.html`.

### Rutas

| Ruta | Pantalla |
| --- | --- |
| `/` | Inicio de sesión (redirige al feed si hay sesión) |
| `/anuncios` | Feed de anuncios |
| `/anuncio/:id` | Feed con la ficha de ese anuncio abierta (enlace compartible) |
| `/perfil/:id` | Perfil de quien publicó, persona o negocio |
| `/mis-anuncios` | Anuncios de la cuenta |
| `/mis-anuncios/:id/editar` | Editar un anuncio propio |
| `/publicar` | Publicar un anuncio |
| `/configuracion` | Configuración de la cuenta |
| `/tipo-cuenta` | Continuar el registro (datos en el `state` del router) |
| `/verificar-correo` | Verificación de correo |
| `/recuperar-clave` | Recuperar contraseña |
