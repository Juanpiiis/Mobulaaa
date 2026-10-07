'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { calcularDescuento } from '@/types/index'
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
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

type Pedido = PedidoCompleto & PedidoCompacto

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

export default function CarteraPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [rolActual, setRolActual] = useState<string | null>(null)
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null)
  const [verCotizacion, setVerCotizacion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)

  // Modal aprobar
  const [modalAprobar, setModalAprobar] = useState<string | null>(null)
  const [observacionAprobar, setObservacionAprobar] = useState('')

  // Modal rechazar
  const [modalRechazar, setModalRechazar] = useState<string | null>(null)
  const [motivoRechazar, setMotivoRechazar] = useState('')
  const [errorRechazar, setErrorRechazar] = useState('')

  const [filtros, setFiltros] = useState<FiltrosValores>(FILTROS_INICIALES)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({})

  const { tiendaActual } = useTienda()
  const supabase = createClient()

  const formatCOP = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value)

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
          producto_id,
          productos(id, nombre, precio, codigo)
        )
      `)
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })

    setPedidos((data as unknown as Pedido[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [tiendaActual])

  // ─────────────────────────────────────────────────────
  // Aprobar pedido
  // ─────────────────────────────────────────────────────
  const iniciarAprobar = (pedidoId: string) => {
    setObservacionAprobar('')
    setModalAprobar(pedidoId)
  }

  const confirmarAprobar = async () => {
    if (!modalAprobar || procesando) return
    const pedido = pedidos.find(p => p.id === modalAprobar)
    if (!pedido) return

    setProcesando(pedido.id)

    try {
      // 1. Calcular totales
      const subtotal = pedido.detalle_pedido.reduce(
        (acc, d) => acc + (d.productos?.precio || 0) * d.cantidad_solicitada,
        0
      )
      const porcentaje = calcularDescuento(subtotal)
      const descuento = subtotal * (porcentaje / 100)
      const total = subtotal - descuento

      // 2. Generar números
      const { generarNumeroCotizacion, generarNumeroFactura } = await import('@/lib/utils/cotizacion')
      const numeroCotizacion = await generarNumeroCotizacion(supabase)
      const numeroFactura = generarNumeroFactura()

      // 3. Actualizar pedido
      const { error: errUpdate } = await supabase
        .from('pedidos')
        .update({
          estado: 'aprobado_cartera',
          subtotal,
          descuento_porcentaje: porcentaje,
          descuento_valor: descuento,
          total,
          numero_cotizacion: numeroCotizacion,
          numero_factura: numeroFactura,
          aprobado_cartera_en: new Date().toISOString(),
        })
        .eq('id', pedido.id)

      if (errUpdate) {
        alert('Error actualizando pedido: ' + errUpdate.message)
        setProcesando(null)
        return
      }

      // 4. Registrar en historial
      const { registrarCambioHistorial } = await import('@/lib/utils/historial')
      await registrarCambioHistorial({
        pedidoId: pedido.id,
        accion: 'aprobado_cartera',
        estadoAnterior: 'aprobado_bodega',
        estadoNuevo: 'aprobado_cartera',
        observacion: observacionAprobar.trim()
          ? `Aprobado por cartera. Cotización: ${numeroCotizacion}. Obs: ${observacionAprobar.trim()}`
          : `Aprobado por cartera. Cotización: ${numeroCotizacion}`,
        cambios: {
          numero_cotizacion: numeroCotizacion,
          numero_factura: numeroFactura,
          total,
        },
      })

      // 5. Generar PDF y subir a Drive
      const res = await fetch('/api/cotizacion/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId: pedido.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error('Error generando PDF:', data)
        alert(
          'Pedido aprobado, pero hubo un error generando el PDF: ' +
          (data.error || 'Error desconocido')
        )
      } else {
        await registrarCambioHistorial({
          pedidoId: pedido.id,
          accion: 'cotizacion_generada',
          observacion: data.url
            ? `PDF subido a Google Drive`
            : `PDF generado (Drive no disponible: ${data.driveError})`,
          cambios: {
            numero_cotizacion: numeroCotizacion,
            carpeta: data.subcarpeta,
            archivo: data.nombreArchivo,
            url: data.url,
          },
        })

        if (data.url) {
          alert(
            `✅ Pedido aprobado\n\n` +
            `Cotización: ${data.numeroCotizacion}\n` +
            `Carpeta: ${data.subcarpeta}\n` +
            `Archivo: ${data.nombreArchivo}\n\n` +
            `El PDF se subió a Drive`
          )
        } else {
          alert(
            `✅ Pedido aprobado\n\n` +
            `Cotización: ${data.numeroCotizacion}\n\n` +
            `⚠️ El PDF se generó pero NO se pudo subir a Drive.`
          )
        }
      }

      setModalAprobar(null)
      setObservacionAprobar('')
      fetchOrders()
    } finally {
      setProcesando(null)
    }
  }

  // ─────────────────────────────────────────────────────
  // Rechazar pedido → vuelve a 'devuelto_por_cartera'
  // ─────────────────────────────────────────────────────
  const iniciarRechazar = (pedidoId: string) => {
    setMotivoRechazar('')
    setErrorRechazar('')
    setModalRechazar(pedidoId)
  }

  const confirmarRechazar = async () => {
    if (!modalRechazar || procesando) return
    setErrorRechazar('')

    if (motivoRechazar.trim().length < 10) {
      setErrorRechazar('El motivo debe tener al menos 10 caracteres.')
      return
    }

    const pedido = pedidos.find(p => p.id === modalRechazar)
    if (!pedido) return

    setProcesando(pedido.id)

    // 1. Devolver el pedido a 'devuelto_por_cartera'
    const { error: errUpdate } = await supabase
      .from('pedidos')
      .update({ estado: 'devuelto_por_cartera' })
      .eq('id', pedido.id)

    if (errUpdate) {
      setErrorRechazar('Error actualizando pedido: ' + errUpdate.message)
      setProcesando(null)
      return
    }

    // 2. Registrar en historial
    const { registrarCambioHistorial } = await import('@/lib/utils/historial')
    await registrarCambioHistorial({
      pedidoId: pedido.id,
      accion: 'devuelto_por_cartera',
      estadoAnterior: 'aprobado_bodega',
      estadoNuevo: 'devuelto_por_cartera',
      observacion: `Devuelto por cartera. Motivo: ${motivoRechazar.trim()}`,
      cambios: {
        motivo: motivoRechazar.trim(),
      },
    })

    setModalRechazar(null)
    setMotivoRechazar('')
    setProcesando(null)
    fetchOrders()

    alert('Pedido devuelto a bodega. El admin decidirá si devolverlo al vendedor o cancelarlo.')
  }

  // ─────────────────────────────────────────────────────
  // Separación
  // ─────────────────────────────────────────────────────
  const porAprobar = useMemo(() => {
    const arr = pedidos.filter(p => p.estado === 'aprobado_bodega')
    // Ordenar: importantes primero, luego fecha ascendente
    return [...arr].sort((a, b) => {
      if (a.importante && !b.importante) return -1
      if (!a.importante && b.importante) return 1
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    })
  }, [pedidos])

  const vendedoresUnicos = useMemo(() => {
    const set = new Set<string>()
    pedidos.forEach(p => { if (p.usuarios?.nombre) set.add(p.usuarios.nombre) })
    return Array.from(set).sort().map(v => ({ valor: v, etiqueta: v }))
  }, [pedidos])

  const historialFiltrado = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()
    return pedidos.filter(p => {
      // Historial: todo menos lo que está por aprobar
      if (p.estado === 'aprobado_bodega') return false

      // Filtro estado
      if (filtros.estado === 'pendiente' && p.estado !== 'pendiente') return false
      if (filtros.estado === 'aprobado' && !['aprobado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'despachado' && p.estado !== 'despachado') return false
      if (filtros.estado === 'entregado' && p.estado !== 'entregado') return false
      if (filtros.estado === 'rechazado' && !['rechazado_bodega', 'rechazado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'cancelado' && p.estado !== 'cancelado') return false

      // Filtro fecha
      if (!estaEnRango(p.fecha, filtros.fecha)) return false

      // Filtro vendedor
      if (filtros.extra !== 'todos' && p.usuarios?.nombre !== filtros.extra) return false

      // Búsqueda por texto
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
        ].filter(Boolean).map(s => String(s).toLowerCase())
        if (!partes.some(s => s.includes(q))) return false
      }

      return true
    })
  }, [pedidos, filtros])

  const historialPorMes = useMemo(() => {
    const grupos: Record<string, Pedido[]> = {}
    historialFiltrado.forEach(p => {
      const key = getMesKey(p.fecha)
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(p)
    })
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
  }, [historialFiltrado])

  useEffect(() => {
    if (historialPorMes.length > 0) {
      setMesesAbiertos(prev => {
        const nuevo = { ...prev }
        if (Object.keys(nuevo).length === 0) nuevo[historialPorMes[0][0]] = true
        return nuevo
      })
    }
  }, [historialPorMes.length])

  const toggleMes = (key: string) => {
    setMesesAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const quitarFiltro = (campo: keyof FiltrosValores) => {
    setFiltros(prev => ({ ...prev, [campo]: campo === 'busqueda' ? '' : 'todos' }))
  }

  const pedidoActual = pedidos.find(p => p.id === pedidoAbierto) || null
  const pedidoAprobando = pedidos.find(p => p.id === modalAprobar) || null
  const pedidoRechazando = pedidos.find(p => p.id === modalRechazar) || null

  // ─────────────────────────────────────────────────────
  // Acciones de la tarjeta
  // ─────────────────────────────────────────────────────
  const renderAcciones = (pedido: Pedido) => {
    if (pedido.estado !== 'aprobado_bodega') return undefined

    const cargando = procesando === pedido.id
    const btns: React.ReactNode[] = []

    btns.push(
      <button
        key="rechazar"
        onClick={() => iniciarRechazar(pedido.id)}
        disabled={cargando}
        title="Devolver a bodega"
        aria-label="Rechazar"
        className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 active:scale-[0.95] disabled:opacity-50 transition-all shrink-0"
      >
        <XCircleIcon className="w-4 h-4" />
        <span className="hidden sm:inline text-xs font-medium">Rechazar</span>
      </button>
    )

    btns.push(
      <button
        key="aprobar"
        onClick={() => iniciarAprobar(pedido.id)}
        disabled={cargando}
        title="Aprobar y generar cotización"
        aria-label="Aprobar"
        className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
      >
        {cargando ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <CheckCircleIcon className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold">Aprobar</span>
          </>
        )}
      </button>
    )

    return btns
  }

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#232323]">Cartera</h1>
            <p className="text-sm text-[#828282] truncate mt-0.5">{tiendaActual?.nombre}</p>
          </div>
          <button
            onClick={() => setFiltrosAbiertos(true)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] active:scale-[0.98] transition-all shadow-sm min-h-[44px]"
          >
            <FunnelIcon className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {(filtros.busqueda.trim() || filtros.fecha !== 'todo' || filtros.estado !== 'todos' || filtros.extra !== 'todos') && (
          <div className="border-t border-gray-100 bg-white">
            <div className="w-full px-4 sm:px-6 py-3">
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
      <main className="w-full px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* POR APROBAR */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-[#232323]">🔥 Por aprobar</h2>
                <span className="text-sm font-semibold bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">
                  {porAprobar.length}
                </span>
              </div>

              {porAprobar.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <ClipboardDocumentListIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-[#828282]">No hay pedidos pendientes de aprobación</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {porAprobar.map(p => (
                    <PedidoCardCompacta
                      key={p.id}
                      pedido={p}
                      onClick={() => setPedidoAbierto(p.id)}
                      acciones={renderAcciones(p)}
                      esAdmin={rolActual === 'admin'}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* HISTORIAL */}
            <section>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-[#232323]">📚 Historial</h2>
                  <span className="text-sm text-[#828282]">
                    {historialFiltrado.length} {historialFiltrado.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
              </div>

              {historialFiltrado.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
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
                <div className="space-y-4">
                  {historialPorMes.map(([mesKey, itemsMes]) => {
                    const abierto = mesesAbiertos[mesKey] ?? false
                    return (
                      <div
                        key={mesKey}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                      >
                        <button
                          onClick={() => toggleMes(mesKey)}
                          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {abierto ? (
                              <ChevronDownIcon className="w-5 h-5 text-[#828282]" />
                            ) : (
                              <ChevronRightIcon className="w-5 h-5 text-[#828282]" />
                            )}
                            <span className="font-semibold text-base text-[#232323]">
                              📅 {getMesLabel(itemsMes[0].fecha)}
                            </span>
                            <span className="text-sm text-[#828282]">
                              ({itemsMes.length})
                            </span>
                          </div>
                        </button>

                        {abierto && (
                          <div className="p-4 pt-0 space-y-3">
                            {itemsMes.map(p => (
                              <PedidoCardCompacta
                                key={p.id}
                                pedido={p}
                                onClick={() => setPedidoAbierto(p.id)}
                                esAdmin={rolActual === 'admin'}
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

      {/* FILTROS */}
      <FiltrosModal
        abierto={filtrosAbiertos}
        onClose={() => setFiltrosAbiertos(false)}
        valores={filtros}
        onAplicar={setFiltros}
        extraLabel="Vendedor"
        extraOpciones={vendedoresUnicos}
        placeholderBusqueda="Buscar por COT, factura, cliente o vendedor..."
      />

      {/* DETALLE */}
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

      {/* MODAL APROBAR */}
      {pedidoAprobando && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#232323]">Aprobar pedido</h3>
                  <p className="text-xs text-[#828282] mt-0.5">
                    Se generará la cotización oficial
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#828282]">
                  <span>Cliente</span>
                  <span className="font-medium text-[#232323] truncate max-w-[60%] text-right">
                    {pedidoAprobando.clientes?.nombre || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-[#828282]">
                  <span>Productos</span>
                  <span className="font-medium text-[#232323]">
                    {pedidoAprobando.detalle_pedido.length}
                  </span>
                </div>
                <div className="flex justify-between text-[#828282]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#232323] tabular-nums">
                    {formatCOP(pedidoAprobando.detalle_pedido.reduce(
                      (acc, d) => acc + (d.productos?.precio || 0) * d.cantidad_solicitada, 0
                    ))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-2">
                  Observación (opcional)
                </label>
                <textarea
                  value={observacionAprobar}
                  onChange={(e) => setObservacionAprobar(e.target.value)}
                  placeholder="Ej: Aprobado sin novedades..."
                  rows={3}
                  disabled={procesando === pedidoAprobando.id}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 resize-none"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  ℹ️ Al aprobar, se generará el número COT oficial y se subirá el PDF a Google Drive.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 p-4 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => setModalAprobar(null)}
                disabled={procesando === pedidoAprobando.id}
                className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 min-h-[48px]"
              >
                Cancelar
              </button>
              <div className="hidden sm:block flex-1" />
              <button
                onClick={confirmarAprobar}
                disabled={procesando === pedidoAprobando.id}
                className="w-full sm:w-auto px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 min-h-[48px] flex items-center justify-center gap-2 transition-all"
              >
                {procesando === pedidoAprobando.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Aprobar y generar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECHAZAR */}
      {pedidoRechazando && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

            {/* HEADER */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#232323]">Rechazar pedido</h3>
                  <p className="text-xs text-[#828282] mt-0.5">
                    El pedido volverá a bodega para ser revisado
                  </p>
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-xs text-orange-800">
                <p className="font-semibold mb-2">⚠️ ¿Qué va a pasar?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>El pedido vuelve a <strong>bodega</strong> (queda para revisión del admin)</li>
                  <li>El <strong>admin</strong> decide si devolverlo al vendedor o cancelarlo</li>
                  <li>Se registra el motivo en el historial</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-2">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoRechazar}
                  onChange={(e) => {
                    setMotivoRechazar(e.target.value)
                    setErrorRechazar('')
                  }}
                  placeholder="Ej: Precios incorrectos, cantidades no coinciden..."
                  rows={3}
                  disabled={procesando === pedidoRechazando.id}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none"
                />
                <p className="text-[10px] text-[#828282] mt-1">
                  {motivoRechazar.trim().length} / 10 caracteres mínimo
                </p>
              </div>

              {errorRechazar && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {errorRechazar}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="border-t border-gray-100 p-4 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => setModalRechazar(null)}
                disabled={procesando === pedidoRechazando.id}
                className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 min-h-[48px]"
              >
                Cancelar
              </button>
              <div className="hidden sm:block flex-1" />
              <button
                onClick={confirmarRechazar}
                disabled={procesando === pedidoRechazando.id || motivoRechazar.trim().length < 10}
                className="w-full sm:w-auto px-5 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px] flex items-center justify-center gap-2 transition-all"
              >
                {procesando === pedidoRechazando.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5" />
                    Rechazar y devolver
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}