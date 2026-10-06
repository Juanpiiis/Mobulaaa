import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],

  allowedDevOrigins: ['*.ngrok-free.app', 'localhost:3000'],

  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.ngrok-free.app',
      ],
    },
  },
}

export default nextConfig