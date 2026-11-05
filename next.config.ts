import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 1. Marcar los paquetes como externos para evitar errores de empaquetado en Vercel
  serverExternalPackages: ['@react-pdf/renderer', 'pdfkit'],

  // 2. Incluir explícitamente los archivos de fuentes en AMBAS rutas (raíz y anidada)
  outputFileTracingIncludes: {
    '/api/cotizacion/**': [
      './node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/pdfkit/js/data/*.afm',
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

  // 🔥 CABECERAS DE SEGURIDAD Y CORS PARA EL WEBVIEW Y PDFs
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // CSP Actualizado: Permite blobs (para el PDF), iframes y conexiones a Supabase
            key: 'Content-Security-Policy',
            value: "default-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' blob:; font-src 'self' data:;"
          },
          {
            // Permite que ngrok o cualquier proxy acceda sin problemas de CORS
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization'
          }
        ]
      }
    ]
  }
}

export default nextConfig