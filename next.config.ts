import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'pdfkit'],

  outputFileTracingIncludes: {
    // 🔥 Usar la ruta exacta de tu API, no el comodín /** 
    // (Next.js a veces ignora los comodines en App Router)
    '/api/cotizacion/generar': [
      './node_modules/@react-pdf/renderer/node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/@react-pdf/renderer/node_modules/pdfkit/js/data/*.afm',
      './node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/pdfkit/js/data/*.afm',
    ],
    '/api/cotizacion/preview': [
      './node_modules/@react-pdf/renderer/node_modules/pdfkit/js/standard-fonts/*.cjs',
      './node_modules/@react-pdf/renderer/node_modules/pdfkit/js/data/*.afm',
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

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' blob:; font-src 'self' data:;"
          },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' }
        ]
      }
    ]
  }
}

export default nextConfig