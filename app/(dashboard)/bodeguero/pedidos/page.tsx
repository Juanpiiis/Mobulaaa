'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { CotizacionPreview } from '@/components/cotizaciones/CotizacionPreview'
import { PedidoDetalleModal, type PedidoCompleto } from '@/components/pedidos/PedidoDetalleModal'
import { PedidoCardCompacta, type PedidoCompacto } from '@/components/pedidos/PedidoCardCompacta'
import {
  FiltrosModal,
  FiltrosChips,
  FILTROS_INICIALES,
  type FiltrosValores,
} from '@/components/pedidos/FiltrosModal'
import {
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────
type Pedido = PedidoCompleto & PedidoCompacto

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function getMesKey(fechaISO: string) {
  const d = new Date(fechaISO)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesLabel(fechaISO: string) {
  const d = new Date(fechaISO)
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function estaEnRango(fechaISO: string, rango: 'hoy' | '7d' | '30d' | 'mes' | 'todo') {
  if (rango === 'todo') return true
  const fecha = new Date(fechaISO)
  const ahora = new Date()
  const ms = 1000 * 60 * 60 * 24

  if (rango === 'hoy') {
    return (
      fecha.getDate() === ahora.getDate() &&
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getFullYear() === ahora.getFullYear()
    )
  }
  if (rango === '7d') return ahora.getTime() - fecha.getTime() <= 7 * ms
  if (rango === '30d') return ahora.getTime() - fecha.getTime() <= 30 * ms
  if (rango === 'mes') {
    return (
      fecha.getMonth() === ahora.getMonth() &&
      fecha.getFullYear() === ahora.getFullYear()
    )
  }
  return true
}

// ─────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────
export default function PedidosBodegueroPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [rolActual, setRolActual] = useState<string | null>(null)
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null)
  const [verCotizacion, setVerCotizacion] = useState<string | null>(null)

  // Filtros
  const [filtros, setFiltros] = useState<FiltrosValores>(FILTROS_INICIALES)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({})

  const { tiendaActual } = useTienda()
  const supabase = createClient()

  // ─────────────────────────────────────────────────────
  // Fetch
  // ─────────────────────────────────────────────────────
  const fetchOrders = async () => {
    if (!tiendaActual) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()
      setRolActual(perfil?.rol || null)
    }

    const { data } = await supabase
      .from('pedidos')
      .select(`
                *,
                usuarios(nombre, email),
                bodegas(id, nombre),
                clientes(nombre, cc_nit, telefono),
                detalle_pedido(
                    id,
                    cantidad_solicitada,
                    cantidad_aprobada,
                    productos(id, nombre, precio, codigo)
                )
            `)
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })

    setPedidos(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [tiendaActual])

  // ─────────────────────────────────────────────────────
  // Separación de pedidos
  // ─────────────────────────────────────────────────────

  // En proceso: pendiente, aprobado_bodega, aprobado_cartera
  const { enProcesoNormales, enProcesoRevertidos } = useMemo(() => {
    const proceso = pedidos.filter(p =>
      ['pendiente', 'aprobado_bodega', 'aprobado_cartera'].includes(p.estado)
    )
    return {
      enProcesoNormales: proceso.filter(p => !p.revertido),
      enProcesoRevertidos: proceso.filter(p => p.revertido),
    }
  }, [pedidos])

  // Vendedores únicos (para filtro extra)
  const vendedoresUnicos = useMemo(() => {
    const set = new Set<string>()
    pedidos.forEach(p => {
      if (p.usuarios?.nombre) set.add(p.usuarios.nombre)
    })
    return Array.from(set).sort().map(v => ({ valor: v, etiqueta: v }))
  }, [pedidos])

  // Historial filtrado
  const historialFiltrado = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()

    return pedidos.filter(p => {
      // Solo históricos (excluye los que están "en proceso")
      if (!['despachado', 'entregado', 'rechazado_bodega', 'rechazado_cartera', 'cancelado'].includes(p.estado)) {
        return false
      }

      // ─── FILTRO ESTADO ───
      if (filtros.estado === 'pendiente' && p.estado !== 'pendiente') return false
      if (filtros.estado === 'aprobado' && !['aprobado_bodega', 'aprobado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'despachado' && p.estado !== 'despachado') return false
      if (filtros.estado === 'entregado' && p.estado !== 'entregado') return false
      if (filtros.estado === 'rechazado' && !['rechazado_bodega', 'rechazado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'cancelado' && p.estado !== 'cancelado') return false

      // ─── FILTRO FECHA ───
      if (!estaEnRango(p.fecha, filtros.fecha)) return false

      // ─── FILTRO VENDEDOR ───
      if (filtros.extra !== 'todos' && p.usuarios?.nombre !== filtros.extra) return false

      // ─── BÚSQUEDA ───
      if (q) {
        const partes = [
          p.numero_cotizacion,
          p.numero_factura,
          p.id,
          String(p.id).slice(0, 8),
          p.usuarios?.nombre,
          p.clientes?.nombre,
          p.clientes?.cc_nit,
          p.observacion,
        ]
          .filter(Boolean)
          .map(s => String(s).toLowerCase())
        if (!partes.some(s => s.includes(q))) return false
      }

      return true
    })
  }, [pedidos, filtros])

  // Agrupado por mes
  const historialPorMes = useMemo(() => {
    const grupos: Record<string, Pedido[]> = {}
    historialFiltrado.forEach(p => {
      const key = getMesKey(p.fecha)
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(p)
    })
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
  }, [historialFiltrado])

  // Abrir primer mes automáticamente
  useEffect(() => {
    if (historialPorMes.length > 0) {
      setMesesAbiertos(prev => {
        const nuevo = { ...prev }
        if (Object.keys(nuevo).length === 0) {
          nuevo[historialPorMes[0][0]] = true
        }
        return nuevo
      })
    }
  }, [historialPorMes.length])

  const toggleMes = (key: string) => {
    setMesesAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Chips filtros
  const quitarFiltro = (campo: keyof FiltrosValores) => {
    setFiltros(prev => ({
      ...prev,
      [campo]: campo === 'busqueda' ? '' : 'todos',
    }))
  }

  // Pedido abierto (objeto completo)
  const pedidoActual = pedidos.find(p => p.id === pedidoAbierto) || null

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F7FB]">
      {/* HEADER */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#232323]">Pedidos</h1>
            <p className="text-xs text-[#828282] truncate">{tiendaActual?.nombre}</p>
          </div>
          <button
            onClick={() => setFiltrosAbiertos(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-medium hover:bg-[#130066] active:scale-[0.98] transition-all shadow-sm"
          >
            <FunnelIcon className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {/* Chips de filtros activos */}
        {(filtros.busqueda.trim() || filtros.fecha !== 'todo' || filtros.estado !== 'todos' || filtros.extra !== 'todos') && (
          <div className="border-t border-gray-100 bg-white">
            <div className="max-w-5xl mx-auto px-4 py-3">
              <FiltrosChips
                valores={filtros}
                onQuitar={quitarFiltro}
                onLimpiar={() => setFiltros(FILTROS_INICIALES)}
                extraLabel="Vendedor"
                extraOpciones={vendedoresUnicos}
              />
            </div>
          </div>
        )}
      </header>

      {/* CONTENIDO */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* ═══════════════════════════════════════════ */}
            {/* SECCIÓN: EN PROCESO                          */}
            {/* ═══════════════════════════════════════════ */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-base font-bold text-[#232323]">
                  🔥 En proceso
                </h2>
                <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  {enProcesoNormales.length + enProcesoRevertidos.length}
                </span>
              </div>

              {/* Pedidos normales en proceso */}
              {enProcesoNormales.length === 0 && enProcesoRevertidos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-[#828282]">No hay pedidos en proceso</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {enProcesoNormales.map(p => (
                    <PedidoCardCompacta
                      key={p.id}
                      pedido={p}
                      onClick={() => setPedidoAbierto(p.id)}
                    />
                  ))}
                </div>
              )}

              {/* Subsección: Revertidos */}
              {enProcesoRevertidos.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3 pl-1">
                    <ArrowPathIcon className="w-4 h-4 text-orange-600" />
                    <h3 className="text-sm font-bold text-orange-700">
                      Revertidos — revisar antes de despachar
                    </h3>
                    <span className="text-xs font-medium bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                      {enProcesoRevertidos.length}
                    </span>
                  </div>
                  <div className="space-y-3 p-3 bg-orange-50/50 border border-orange-200 rounded-2xl">
                    {enProcesoRevertidos.map(p => (
                      <PedidoCardCompacta
                        key={p.id}
                        pedido={p}
                        onClick={() => setPedidoAbierto(p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ═══════════════════════════════════════════ */}
            {/* SECCIÓN: HISTORIAL                            */}
            {/* ═══════════════════════════════════════════ */}
            <section>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#232323]">
                    📚 Historial
                  </h2>
                  <span className="text-xs text-[#828282]">
                    {historialFiltrado.length} {historialFiltrado.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
              </div>

              {historialFiltrado.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <p className="text-sm text-[#828282]">
                    {filtros.busqueda.trim() ||
                      filtros.fecha !== 'todo' ||
                      filtros.estado !== 'todos' ||
                      filtros.extra !== 'todos'
                      ? 'No hay pedidos que coincidan con los filtros'
                      : 'Aún no hay pedidos en el historial'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historialPorMes.map(([mesKey, itemsMes]) => {
                    const abierto = mesesAbiertos[mesKey] ?? false
                    return (
                      <div
                        key={mesKey}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                      >
                        <button
                          onClick={() => toggleMes(mesKey)}
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {abierto ? (
                              <ChevronDownIcon className="w-4 h-4 text-[#828282]" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-[#828282]" />
                            )}
                            <span className="font-semibold text-sm text-[#232323]">
                              📅 {getMesLabel(itemsMes[0].fecha)}
                            </span>
                            <span className="text-xs text-[#828282]">
                              ({itemsMes.length})
                            </span>
                          </div>
                          {!abierto && itemsMes.some(p => p.revertido) && (
                            <span className="text-[10px] text-orange-600 font-medium">
                              incluye revertidos
                            </span>
                          )}
                        </button>

                        {abierto && (
                          <div className="p-3 pt-0 space-y-2">
                            {itemsMes.map(p => (
                              <PedidoCardCompacta
                                key={p.id}
                                pedido={p}
                                onClick={() => setPedidoAbierto(p.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* MODALES */}
      <FiltrosModal
        abierto={filtrosAbiertos}
        onClose={() => setFiltrosAbiertos(false)}
        valores={filtros}
        onAplicar={setFiltros}
        extraLabel="Vendedor"
        extraOpciones={vendedoresUnicos}
        placeholderBusqueda="Buscar por COT, factura, pedido, cliente o vendedor..."
      />

      {pedidoActual && (
        <PedidoDetalleModal
          pedido={pedidoActual}
          onClose={() => setPedidoAbierto(null)}
          onRefresh={fetchOrders}
          rolActual={rolActual}
          onVerCotizacion={(id) => {
            setPedidoAbierto(null)
            setVerCotizacion(id)
          }}
        />
      )}

      {verCotizacion && (
        <CotizacionPreview
          pedidoId={verCotizacion}
          onClose={() => setVerCotizacion(null)}
        />
      )}
    </div>
  )
}