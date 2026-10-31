import { defineConfig } from 'vite';

// https://vitejs.dev/config
// All npm dependencies (ws, qrcode, etc.) are bundled by Rollup into .vite/build/main.js
// so that app.asar is completely self-contained with zero missing module exceptions at runtime.
export default defineConfig({
  define: {
    'process.env.WS_NO_BUFFER_UTIL': '"true"',
    'process.env.WS_NO_UTF_8_VALIDATE': '"true"',
  },
});
