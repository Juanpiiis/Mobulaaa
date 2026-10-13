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
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TruckIcon,
  ArchiveBoxIcon,
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

export default function PedidosAdminPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [rolActual, setRolActual] = useState<string | null>(null)
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null)
  const [abrirEnEdicion, setAbrirEnEdicion] = useState(false)
  const [verCotizacion, setVerCotizacion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  // Modal rechazar
  const [modalRechazar, setModalRechazar] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [confirmadoRechazo, setConfirmadoRechazo] = useState(false)
  const [errorRechazo, setErrorRechazo] = useState('')

  const [filtros, setFiltros] = useState<FiltrosValores>(FILTROS_INICIALES)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({})

  const { tiendaActual } = useTienda()
  const supabase = createClient()

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

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        usuarios(nombre, email),
        bodegas(id, nombre),
        clientes(nombre, cc_nit, telefono),
        detalle_pedido(
          id,
          producto_id,
          cantidad_solicitada,
          cantidad_aprobada,
          precio_unitario,
          tipo_precio,
          productos ( id, nombre, precio, codigo )
        )
      `)
      .eq('bodega_id', tiendaActual.id)
      .order('fecha', { ascending: false })

    if (error) {
      console.error('Error cargando pedidos:', error)
      setErrorAccion('No se pudieron cargar los pedidos: ' + error.message)
    }

    setPedidos((data as unknown as Pedido[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiendaActual])

  // ─────────────────────────────────────────────
  // HISTORIAL
  // ─────────────────────────────────────────────
  const registrarHistorial = async (
    pedidoId: string,
    accion: string,
    estadoAnterior: string,
    estadoNuevo: string,
    observacion: string
  ) => {
    const { registrarCambioHistorial } = await import('@/lib/utils/historial')
    await registrarCambioHistorial({
      pedidoId,
      accion: accion as any,
      estadoAnterior,
      estadoNuevo,
      observacion,
    })
  }

  // ─────────────────────────────────────────────
  // ACCIONES
  // ─────────────────────────────────────────────

  // aprobado_cartera → en_preparacion
  const handleAceptar = async (pedidoId: string) => {
    if (procesando) return
    setProcesando(pedidoId)
    setErrorAccion('')

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'en_preparacion' })
      .eq('id', pedidoId)
      .eq('estado', 'aprobado_cartera')
      .select('id')

    if (error) {
      setErrorAccion('No se pudo aceptar: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está en aprobado_cartera. Recarga.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedidoId, 'editado', 'aprobado_cartera', 'en_preparacion', 'Bodega aceptó y empieza a alistar')
    setProcesando(null)
    fetchOrders()
  }

  // en_preparacion → listo_para_despacho
  const handleMarcarListo = async (pedidoId: string) => {
    if (procesando) return
    setProcesando(pedidoId)
    setErrorAccion('')

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'listo_para_despacho' })
      .eq('id', pedidoId)
      .eq('estado', 'en_preparacion')
      .select('id')

    if (error) {
      setErrorAccion('No se pudo marcar listo: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está en en_preparacion. Recarga.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedidoId, 'editado', 'en_preparacion', 'listo_para_despacho', 'Bodega terminó el alistamiento')
    setProcesando(null)
    fetchOrders()
  }

  // listo_para_despacho → despachado (rpc, directo, sin modal)
  const handleDespachar = async (pedido: Pedido) => {
    if (procesando) return
    setProcesando(pedido.id)
    setErrorAccion('')

    // Enviamos todas las cantidades aprobadas (o solicitadas si no hay aprobadas).
    const p_cantidades = pedido.detalle_pedido.map(d => ({
      detalle_id: d.id,
      cantidad: d.cantidad_aprobada ?? d.cantidad_solicitada,
    }))

    const { error: errRpc } = await supabase.rpc('despachar_pedido', {
      p_pedido: pedido.id,
      p_cantidades,
    })

    if (errRpc) {
      setErrorAccion('No se pudo despachar: ' + errRpc.message)
      setProcesando(null)
      return
    }

    setProcesando(null)
    fetchOrders()
  }

  // despachado → entregado
  const marcarEntregado = async (pedidoId: string) => {
    if (procesando) return
    setProcesando(pedidoId)
    setErrorAccion('')

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'entregado' })
      .eq('id', pedidoId)
      .eq('estado', 'despachado')
      .select('id')

    if (error) {
      setErrorAccion('No se pudo marcar entregado: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está despachado. Recarga.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedidoId, 'entregado', 'despachado', 'entregado', 'Pedido entregado al cliente')
    setProcesando(null)
    fetchOrders()
  }

  // Rechazar (admin)
  const iniciarRechazo = (pedidoId: string) => {
    setMotivoRechazo('')
    setConfirmadoRechazo(false)
    setErrorRechazo('')
    setModalRechazar(pedidoId)
  }

  const confirmarRechazo = async () => {
    if (!modalRechazar || procesando) return
    setErrorRechazo('')

    if (motivoRechazo.trim().length < 10) {
      setErrorRechazo('El motivo debe tener al menos 10 caracteres.')
      return
    }
    if (!confirmadoRechazo) {
      setErrorRechazo('Debes marcar la casilla de confirmación.')
      return
    }

    const pedido = pedidos.find(p => p.id === modalRechazar)
    if (!pedido) return

    setProcesando(modalRechazar)

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'rechazado_bodega' })
      .eq('id', modalRechazar)
      .eq('estado', pedido.estado)
      .select('id')

    if (error) {
      setErrorRechazo('No se pudo rechazar: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorRechazo('El pedido cambió de estado. Recarga la página.')
      setProcesando(null)
      setModalRechazar(null)
      fetchOrders()
      return
    }

    await registrarHistorial(
      modalRechazar,
      'rechazado_bodega',
      pedido.estado,
      'rechazado_bodega',
      `Rechazado por admin. Motivo: ${motivoRechazo.trim()}`
    )

    setProcesando(null)
    setModalRechazar(null)
    setMotivoRechazo('')
    fetchOrders()
  }

  // Importante
  const toggleImportante = async (pedidoId: string, importante: boolean) => {
    if (procesando) return
    setProcesando(pedidoId)

    const { error } = await supabase
      .from('pedidos')
      .update({ importante })
      .eq('id', pedidoId)

    if (error) {
      alert('No se pudo actualizar el pedido')
      setProcesando(null)
      return
    }

    await registrarHistorial(
      pedidoId,
      'editado',
      '',
      '',
      importante ? 'Marcado como importante' : 'Desmarcado como importante'
    )
    setProcesando(null)
    fetchOrders()
  }

  // ─────────────────────────────────────────────
  // AGRUPACIÓN
  // ─────────────────────────────────────────────
  const vendedoresUnicos = useMemo(() => {
    const set = new Set<string>()
    pedidos.forEach(p => { if (p.usuarios?.nombre) set.add(p.usuarios.nombre) })
    return Array.from(set).sort().map(v => ({ valor: v, etiqueta: v }))
  }, [pedidos])

  const enProceso = useMemo(() => {
    const arr = pedidos.filter(p =>
      ['pendiente', 'aprobado_cartera', 'en_preparacion', 'listo_para_despacho', 'despachado'].includes(p.estado)
    )
    return [...arr].sort((a, b) => {
      if (a.importante && !b.importante) return -1
      if (!a.importante && b.importante) return 1
      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    })
  }, [pedidos])

  const historialFiltrado = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()
    return pedidos.filter(p => {
      if (!['entregado', 'rechazado_bodega', 'rechazado_cartera', 'cancelado', 'devuelto_por_cartera'].includes(p.estado)) return false

      if (filtros.estado === 'pendiente' && p.estado !== 'pendiente') return false
      if (filtros.estado === 'aprobado' && !['aprobado_cartera', 'en_preparacion', 'listo_para_despacho'].includes(p.estado)) return false
      if (filtros.estado === 'despachado' && p.estado !== 'despachado') return false
      if (filtros.estado === 'entregado' && p.estado !== 'entregado') return false
      if (filtros.estado === 'rechazado' && !['rechazado_bodega', 'rechazado_cartera'].includes(p.estado)) return false
      if (filtros.estado === 'cancelado' && p.estado !== 'cancelado') return false

      if (!estaEnRango(p.fecha, filtros.fecha)) return false
      if (filtros.extra !== 'todos' && p.usuarios?.nombre !== filtros.extra) return false

      if (q) {
        const partes = [
          p.numero_cotizacion, p.numero_factura, p.id, String(p.id).slice(0, 8),
          p.usuarios?.nombre, p.clientes?.nombre, p.clientes?.cc_nit, p.observacion,
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
  const pedidoRechazando = pedidos.find(p => p.id === modalRechazar) || null

  const abrirDetalle = (id: string) => {
    setAbrirEnEdicion(false)
    setPedidoAbierto(id)
  }

  const abrirEdicion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setAbrirEnEdicion(true)
    setPedidoAbierto(id)
  }

  // ─────────────────────────────────────────────
  // BOTONES POR ESTADO
  // ─────────────────────────────────────────────
  const renderAcciones = (pedido: Pedido) => {
    const btns: React.ReactNode[] = []
    const cargando = procesando === pedido.id

    // Editar (todos menos cancelado y entregado)
    if (pedido.estado !== 'cancelado' && pedido.estado !== 'entregado') {
      btns.push(
        <button
          key="editar"
          onClick={(e) => abrirEdicion(pedido.id, e)}
          disabled={cargando}
          title="Editar"
          aria-label="Editar"
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-300 text-[#232323] bg-white hover:bg-gray-50 active:scale-[0.95] disabled:opacity-50 transition-all shrink-0"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      )
    }

    // Rechazar (solo en estados donde tiene sentido)
    const puedeRechazar = ['aprobado_cartera', 'en_preparacion', 'listo_para_despacho'].includes(pedido.estado)
    if (puedeRechazar) {
      btns.push(
        <button
          key="rechazar"
          onClick={(e) => { e.stopPropagation(); iniciarRechazo(pedido.id) }}
          disabled={cargando}
          title="Rechazar"
          aria-label="Rechazar"
          className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 active:scale-[0.95] disabled:opacity-50 transition-all shrink-0"
        >
          <XCircleIcon className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium">Rechazar</span>
        </button>
      )
    }

    if (pedido.estado === 'aprobado_cartera') {
      btns.push(
        <button
          key="aceptar"
          onClick={(e) => { e.stopPropagation(); handleAceptar(pedido.id) }}
          disabled={cargando}
          className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {cargando ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircleIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Aceptar</span>
            </>
          )}
        </button>
      )
    }

    if (pedido.estado === 'en_preparacion') {
      btns.push(
        <button
          key="listo"
          onClick={(e) => { e.stopPropagation(); handleMarcarListo(pedido.id) }}
          disabled={cargando}
          className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {cargando ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ArrowRightIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Marcar listo</span>
            </>
          )}
        </button>
      )
    }

    if (pedido.estado === 'listo_para_despacho') {
      btns.push(
        <button
          key="despachar"
          onClick={(e) => { e.stopPropagation(); handleDespachar(pedido) }}
          disabled={cargando}
          className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {cargando ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <TruckIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Despachar</span>
            </>
          )}
        </button>
      )
    }

    if (pedido.estado === 'despachado') {
      btns.push(
        <button
          key="entregar"
          onClick={(e) => { e.stopPropagation(); marcarEntregado(pedido.id) }}
          disabled={cargando}
          className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          <ArchiveBoxIcon className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-semibold">Entregar</span>
        </button>
      )
    }

    return btns.length > 0 ? btns : undefined
  }

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      {/* HEADER */}
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#232323]">Pedidos</h1>
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

        {errorAccion && (
          <div className="border-t border-red-100 bg-red-50">
            <div className="w-full px-4 sm:px-6 py-2 text-sm text-red-700 flex items-center justify-between gap-3">
              <span>❌ {errorAccion}</span>
              <button onClick={() => setErrorAccion('')} className="text-red-700 hover:text-red-900 text-xs font-medium">
                Cerrar
              </button>
            </div>
          </div>
        )}

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

      <main className="w-full px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* EN PROCESO */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-[#232323]">🔥 En proceso</h2>
                <span className="text-sm font-semibold bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">
                  {enProceso.length}
                </span>
              </div>

              {enProceso.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <ClipboardDocumentListIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-[#828282]">No hay pedidos en proceso</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enProceso.map(p => (
                    <PedidoCardCompacta
                      key={p.id}
                      pedido={p}
                      onClick={() => abrirDetalle(p.id)}
                      acciones={renderAcciones(p)}
                      esAdmin={rolActual === 'admin'}
                      onToggleImportante={toggleImportante}
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
                                onClick={() => abrirDetalle(p.id)}
                                acciones={renderAcciones(p)}
                                esAdmin={rolActual === 'admin'}
                                onToggleImportante={toggleImportante}
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
          onClose={() => { setPedidoAbierto(null); setAbrirEnEdicion(false) }}
          onRefresh={fetchOrders}
          rolActual={rolActual}
          abrirEnModoEdicion={abrirEnEdicion}
          onVerCotizacion={(id) => { setPedidoAbierto(null); setAbrirEnEdicion(false); setVerCotizacion(id) }}
        />
      )}

      {verCotizacion && (
        <CotizacionPreview pedidoId={verCotizacion} onClose={() => setVerCotizacion(null)} />
      )}

      {/* MODAL RECHAZAR */}
      {pedidoRechazando && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#232323]">Rechazar pedido</h3>
                  <p className="text-xs text-[#828282] mt-0.5">
                    Indica el motivo del rechazo
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800">
                <p className="font-semibold mb-2">⚠️ ¿Qué va a pasar?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>El pedido queda en estado <strong>rechazado por bodega</strong></li>
                  <li>Se registra el motivo en el historial</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-2">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => { setMotivoRechazo(e.target.value); setErrorRechazo('') }}
                  placeholder="Explica por qué se rechaza (mín. 10 caracteres)"
                  rows={3}
                  disabled={procesando === pedidoRechazando.id}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
                <p className="text-[10px] text-[#828282] mt-1">
                  {motivoRechazo.trim().length} / 10 caracteres mínimo
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-red-50">
                <input
                  type="checkbox"
                  checked={confirmadoRechazo}
                  onChange={(e) => setConfirmadoRechazo(e.target.checked)}
                  disabled={procesando === pedidoRechazando.id}
                  className="mt-0.5 w-5 h-5 text-red-600 rounded"
                />
                <span className="text-sm text-[#232323]">
                  Entiendo que este pedido será rechazado y quedará registrado en el historial.
                </span>
              </label>

              {errorRechazo && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {errorRechazo}
                </div>
              )}
            </div>

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
                onClick={confirmarRechazo}
                disabled={procesando === pedidoRechazando.id || motivoRechazo.trim().length < 10 || !confirmadoRechazo}
                className="w-full sm:w-auto px-5 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] transition-all"
              >
                {procesando === pedidoRechazando.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5" />
                    Confirmar rechazo
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