import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 1. Marcar ambos paquetes como externos para que no intenten empaquetarlos mal
  serverExternalPackages: ['@react-pdf/renderer', 'pdfkit'],

  // 2. Incluir explícitamente los archivos de fuentes en AMBAS rutas
  outputFileTracingIncludes: {
    '/api/cotizacion/**': [
      // Ruta raíz
      './node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/pdfkit/js/data/*.afm',
      // 🔥 RUTA ANIDADA (la que causaba el error)
      './node_modules/@react-pdf/renderer/node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/@react-pdf/renderer/node_modules/pdfkit/js/data/*.afm',
    ],
  },

  allowedDevOrigins: ['*.ngrok-free.app', 'localhost:3000'],

  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.ngrok-free.app',
        'mobulaaa.vercel.app',
      ],
    },
  },

  // 🔥 ESTO ES LO QUE ARREGLA EL WEBVIEW
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
          }
        ]
      }
    ]
  }
}

export default nextConfig