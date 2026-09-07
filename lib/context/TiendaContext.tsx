'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Bodega {
  id: string
  nombre: string
  tipo: string
}

interface TiendaContextType {
  tiendaActual: Bodega | null
  setTiendaActual: (tienda: Bodega | null) => void
  bodegas: Bodega[]
}

const TiendaContext = createContext<TiendaContextType>({
  tiendaActual: null,
  setTiendaActual: () => {},
  bodegas: []
})

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [tiendaActual, setTiendaActual] = useState<Bodega | null>(null)
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from('bodegas').select('*').eq('activo', true)
      setBodegas(data || [])
    }
    cargar()
  }, [])

  return (
    <TiendaContext.Provider value={{ tiendaActual, setTiendaActual, bodegas }}>
      {children}
    </TiendaContext.Provider>
  )
}

export const useTienda = () => useContext(TiendaContext)