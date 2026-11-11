import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 本地联调：设置 DEV_API_PROXY=http://127.0.0.1:3001 时，把 /api/* 转发到本地
// Serverless 函数宿主（见 scripts/dev-api-server.mjs）。生产构建不受影响。
const apiProxy = process.env.DEV_API_PROXY;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    ...(apiProxy ? { proxy: { '/api': { target: apiProxy, changeOrigin: false } } } : {}),
  },
});
