import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// vite.config.js
export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
  //   base: '/',
  // }

  // if (command !== 'serve') {
  //   // PERHATIKAN SLASH DI DEPAN DAN BELAKANG
  //   config.base = '/paud-rohani-fsr/' 
  }

  return config
})