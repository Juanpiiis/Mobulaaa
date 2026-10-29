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
  cargandoBodegas: boolean
}

const TiendaContext = createContext<TiendaContextType>({
  tiendaActual: null,
  setTiendaActual: () => { },
  bodegas: [],
  recargarBodegas: async () => { },
  soloUnaBodega: false,
  cargandoBodegas: true,
})

const STORAGE_KEY = 'mobulaa-bodega-actual' // 🔥 CLAVE PARA GUARDAR EN LOCALSTORAGE

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [tiendaActual, setTiendaActual] = useState<Bodega | null>(null)
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [cargandoBodegas, setCargandoBodegas] = useState(true)
  const supabase = createClient()

  const { mostrarAviso, continuarSesion, salirAhora, segundosRestantes } = useInactivityLogout()

  const cargarBodegas = useCallback(async () => {
    setCargandoBodegas(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setBodegas([])
      setTiendaActual(null)
      setCargandoBodegas(false)
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

    // 🔥 RECUPERAR LA BODEGA GUARDADA EN LOCALSTORAGE
    const bodegaGuardadaId = localStorage.getItem(STORAGE_KEY)

    setTiendaActual((prev) => {
      if (lista.length === 0) return null

      // 1. Si ya había una bodega seleccionada (en memoria), mantenerla
      if (prev) {
        const existe = lista.find((b) => b.id === prev.id)
        if (existe) return existe
      }

      // 2. Si hay una bodega guardada en localStorage, usarla
      if (bodegaGuardadaId) {
        const guardada = lista.find((b) => b.id === bodegaGuardadaId)
        if (guardada) return guardada
      }

      // 3. Si es admin, buscar Bogotá por defecto
      if (esAdmin) {
        const bogota = lista.find((b) =>
          b.nombre.toLowerCase().includes('bogotá') ||
          b.nombre.toLowerCase().includes('bogota')
        )
        if (bogota) return bogota
      }

      // 4. Si no hay Bogotá o no es admin, toma la primera
      return lista[0]
    })

    setCargandoBodegas(false)
  }, [supabase])

  useEffect(() => {
    cargarBodegas()
  }, [cargarBodegas])

  // 🔥 FUNCIÓN PARA CAMBIAR BODEGA Y GUARDARLA EN LOCALSTORAGE
  const handleSetTiendaActual = useCallback((bodega: Bodega | null) => {
    setTiendaActual(bodega)
    if (bodega) {
      localStorage.setItem(STORAGE_KEY, bodega.id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const soloUnaBodega = bodegas.length <= 1

  return (
    <TiendaContext.Provider
      value={{
        tiendaActual,
        setTiendaActual: handleSetTiendaActual, // 🔥 Usamos la función que guarda en localStorage
        bodegas,
        recargarBodegas: cargarBodegas,
        soloUnaBodega,
        cargandoBodegas,
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