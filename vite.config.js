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
  build: {
    rollupOptions: {
      output: {
        // 把重依赖拆成独立 chunk：主包只留业务代码，首屏更快；
        // vendor 变化频率低，二次访问可命中缓存。Rolldown 需要函数形式。
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'vendor-charts';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/appwrite')) return 'vendor-appwrite';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
