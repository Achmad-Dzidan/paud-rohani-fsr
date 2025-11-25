import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
    base: '/',
    // TAMBAHKAN INI:
    server: {
      port: 3000, // Ganti port jadi 3000
    }
  }

  if (command !== 'serve') {
    config.base = '/paud-rohani-fsr/'
  }

  return config
})