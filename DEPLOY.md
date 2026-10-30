# Frontend Ludito (solo Vercel)

Este repo es **solo el frontend**.

El backend vive aparte en `Desktop/ludito-backend` y se despliega en **Render**.

## Vercel

1. Importa este repo.
2. Variables de entorno (Build):
   - `VITE_WS_URL` = URL pública del backend en Render  
     Ejemplo: `https://ludito-rooms.onrender.com`
   - **Opcional pero recomendado (mejor calidad que el TURN público incluido):**
     - `VITE_TURN_URL` = `turn:TU_HOST:80,turns:TU_HOST:443?transport=tcp`
     - `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL`
     - TURN: [Metered](https://www.metered.ca/tools/openrelay/) o coturn propio
3. Redeploy después de cambiar env (Vite las embebe en el build).

El frontend ya incluye un TURN público de respaldo (`freeturn.net`). Si el video sigue en negro, configura tu propio TURN y verifica `VITE_WS_URL`.

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
