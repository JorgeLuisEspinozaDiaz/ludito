# Frontend Ludito (solo Vercel)

Este repo es **solo el frontend**.

El backend vive aparte en `Desktop/ludito-backend` y se despliega en **Render**.

## Vercel

1. Importa este repo.
2. Variable de entorno:
   - `VITE_WS_URL` = URL pública del backend en Render  
     Ejemplo: `https://ludito-rooms.onrender.com`
3. Deploy.

## Local

```bash
# Terminal 1 — backend (otra carpeta)
cd ../ludito-backend
npm install
npm start

# Terminal 2 — frontend
cd ../ludito
npm install
npm run dev
```

Crea `.env` o `.env.local` en el frontend:

```
VITE_WS_URL=http://localhost:3001
```

(En local también funciona sin variable: usa `ws://localhost:3001` por defecto.)
