import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this repo at /velle-inventory-management/, not the domain root.
  base: '/velle-inventory-management/',
})
