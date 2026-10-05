import './globals.css'
import { ProvidersWithKey } from '@/components/ProvidersWithKey'
import type { Viewport, Metadata } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Mobulaa',
  description: 'Gestión de inventarios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-[100dvh] bg-[#F7F7FB] text-[#232323] antialiased">
        <ProvidersWithKey>
          {children}
        </ProvidersWithKey>
      </body>
    </html>
  )
}