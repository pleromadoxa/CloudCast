import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const buildId = process.env.VITE_APP_BUILD_ID ?? String(Date.now())

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cloudcast-build-id',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `    <meta name="cloudcast-build" content="${buildId}" />\n  </head>`,
        )
      },
    },
  ],
})
