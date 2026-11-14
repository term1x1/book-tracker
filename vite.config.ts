import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Метка сборки: вшивается в код и кладётся рядом в version.json.
// Если они перестали совпадать — у пользователя старая версия.
const buildId = Date.now().toString(36)

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ id: buildId }),
        })
      },
    },
  ],
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    port: 5173,
  },
})
