'use client'
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInactivityLogout } from '@/lib/hooks/useInactivityLogout'
import { SessionTimeoutModal } from '@/components/dashboard/SessionTimeoutModal'

interface Bodega {
  id: string
  nombre: string
  tipo: string
}

interface TiendaContextType {
  tiendaActual: Bodega | null
  setTiendaActual: (tienda: Bodega | null) => void
  bodegas: Bodega[]
  recargarBodegas: () => Promise<void>
  soloUnaBodega: boolean
}

const TiendaContext = createContext<TiendaContextType>({
  tiendaActual: null,
  setTiendaActual: () => { },
  bodegas: [],
  recargarBodegas: async () => { },
  soloUnaBodega: false,
})

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [tiendaActual, setTiendaActual] = useState<Bodega | null>(null)
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const supabase = createClient()

  const { mostrarAviso, continuarSesion, salirAhora, segundosRestantes } = useInactivityLogout()

  const cargarBodegas = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setBodegas([])
      setTiendaActual(null)
      return
    }

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    const esAdmin = perfil?.rol === 'admin'

    let lista: Bodega[] = []

    if (esAdmin) {
      const { data } = await supabase
        .from('bodegas')
        .select('id, nombre, tipo')
        .eq('activo', true)
        .order('nombre')
      lista = data || []
    } else {
      const { data } = await supabase
        .from('usuario_bodegas')
        .select('bodegas(id, nombre, tipo, activo)')
        .eq('usuario_id', user.id)

      lista = (data || [])
        .map((row: any) => row.bodegas)
        .filter((b: any) => b && b.activo)
    }

    setBodegas(lista)

    setTiendaActual((prev) => {
      if (lista.length === 0) return null
      if (!prev) return lista[0]
      const existe = lista.find((b) => b.id === prev.id)
      return existe || lista[0]
    })
  }, [supabase])

  useEffect(() => {
    cargarBodegas()
  }, [cargarBodegas])

  const soloUnaBodega = bodegas.length <= 1

  return (
    <TiendaContext.Provider
      value={{
        tiendaActual,
        setTiendaActual,
        bodegas,
        recargarBodegas: cargarBodegas,
        soloUnaBodega,
      }}
    >
      {children}

      {mostrarAviso && (
        <SessionTimeoutModal
          onContinuar={continuarSesion}
          onSalir={salirAhora}
          segundosRestantes={segundosRestantes}
        />
      )}
    </TiendaContext.Provider>
  )
}

export const useTienda = () => useContext(TiendaContext)