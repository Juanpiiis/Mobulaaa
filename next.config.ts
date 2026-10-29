import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],

  // 🔥 ESTO ES LO QUE ARREGLA EL ERROR DE HELVETICA.CJS
  outputFileTracingIncludes: {
    '/api/cotizacion/**': [
      './node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/pdfkit/js/data/*.afm',
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