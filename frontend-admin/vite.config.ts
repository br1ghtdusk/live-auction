import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,        // 锁定商家端的端口为 5174
    strictPort: true,  // 严格模式：如果 5174 被别人占用了，直接报错
  }
})
