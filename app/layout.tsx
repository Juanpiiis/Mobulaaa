import './globals.css'
import { TiendaProvider } from '@/lib/context/TiendaContext'

export const metadata = {
  title: 'Mobulaa',
  description: 'Gestión de inventarios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TiendaProvider>
          {children}
        </TiendaProvider>
      </body>
    </html>
  )
}