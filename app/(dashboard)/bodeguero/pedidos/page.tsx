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
  ESTADOS_POR_ROL,
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
  ArrowRightIcon,
  TruckIcon,
  ArchiveBoxIcon,
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

export default function PedidosBodegueroPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [rolActual, setRolActual] = useState<string | null>(null)
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null)
  const [verCotizacion, setVerCotizacion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState('')

  const [modalRechazar, setModalRechazar] = useState<string | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
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

    const { data } = await supabase
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
      .in('estado', ['aprobado_cartera', 'en_preparacion', 'listo_para_despacho', 'despachado'])
      .order('fecha', { ascending: true })

    setPedidos((data as unknown as Pedido[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!tiendaActual) return
    fetchOrders()

    // 🔥 Realtime Bodega (solo su bodega)
    const channel = supabase
      .channel(`bodeguero-pedidos-live-${tiendaActual.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `bodega_id=eq.${tiendaActual.id}`
        },
        (payload) => {
          console.log('🔔 Bodega: cambio en pedido, actualizando...', payload)
          fetchOrders()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tiendaActual?.id])

  const registrarHistorial = async (pedidoId: string, accion: string, estadoAnterior: string, estadoNuevo: string, observacion: string) => {
    const { registrarCambioHistorial } = await import('@/lib/utils/historial')
    await registrarCambioHistorial({ pedidoId, accion: accion as any, estadoAnterior, estadoNuevo, observacion })
  }

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
      console.error('Error aceptando pedido:', error)
      setErrorAccion('No se pudo aceptar el pedido: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está en aprobado_cartera. Recarga la página.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedidoId, 'editado', 'aprobado_cartera', 'en_preparacion', 'Bodega aceptó y empieza a alistar')
    setProcesando(null)
    fetchOrders()
  }

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
      console.error('Error marcando listo:', error)
      setErrorAccion('No se pudo marcar como listo: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está en en_preparacion. Recarga la página.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedidoId, 'editado', 'en_preparacion', 'listo_para_despacho', 'Bodega terminó el alistamiento')
    setProcesando(null)
    fetchOrders()
  }

  // 🔥 AHORA SOLO ACTUALIZA EL ESTADO, EL STOCK YA SE DESCONTÓ EN CARTERA
  const handleDespachar = async (pedido: Pedido) => {
    if (procesando) return
    setProcesando(pedido.id)
    setErrorAccion('')

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'despachado' })
      .eq('id', pedido.id)
      .eq('estado', 'listo_para_despacho')
      .select('id')

    if (error) {
      console.error('Error despachando:', error)
      setErrorAccion('No se pudo despachar: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está en listo para despacho. Recarga la página.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedido.id, 'despachado', 'listo_para_despacho', 'despachado', 'Pedido despachado. Stock previamente descontado en cartera.')

    setProcesando(null)
    fetchOrders()
  }

  const handleMarcarEntregado = async (pedidoId: string) => {
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
      console.error('Error marcando entregado:', error)
      setErrorAccion('No se pudo marcar como entregado: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorAccion('El pedido ya no está en despachado. Recarga la página.')
      setProcesando(null)
      fetchOrders()
      return
    }

    await registrarHistorial(pedidoId, 'entregado', 'despachado', 'entregado', 'Pedido entregado al cliente')
    setProcesando(null)
    fetchOrders()
  }

  const iniciarRechazo = (pedidoId: string) => {
    setMotivoRechazo('')
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

    setProcesando(modalRechazar)

    const { data, error } = await supabase
      .from('pedidos')
      .update({ estado: 'rechazado_bodega' })
      .eq('id', modalRechazar)
      .eq('estado', 'aprobado_cartera')
      .select('id')

    if (error) {
      console.error('Error rechazando pedido:', error)
      setErrorRechazo('No se pudo rechazar: ' + error.message)
      setProcesando(null)
      return
    }
    if (!data || data.length === 0) {
      setErrorRechazo('El pedido ya no está en aprobado_cartera. Recarga la página.')
      setProcesando(null)
      setModalRechazar(null)
      fetchOrders()
      return
    }

    await registrarHistorial(
      modalRechazar,
      'rechazado_bodega',
      'aprobado_cartera',
      'rechazado_bodega',
      `Rechazado por bodega. Motivo: ${motivoRechazo.trim()}`
    )

    setProcesando(null)
    setModalRechazar(null)
    setMotivoRechazo('')
    fetchOrders()
  }

  const vendedoresUnicos = useMemo(() => {
    const set = new Set<string>()
    pedidos.forEach(p => { if (p.usuarios?.nombre) set.add(p.usuarios.nombre) })
    return Array.from(set).sort().map(v => ({ valor: v, etiqueta: v }))
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()
    return pedidos.filter(p => {
      // 🔥 Filtro dinámico exacto
      if (filtros.estado !== 'todos' && p.estado !== filtros.estado) return false

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

  const porEstado = useMemo(() => {
    const grupos = {
      aprobado_cartera: [] as Pedido[],
      en_preparacion: [] as Pedido[],
      listo_para_despacho: [] as Pedido[],
      despachado: [] as Pedido[],
    }
    pedidosFiltrados.forEach(p => {
      if (p.estado === 'aprobado_cartera') grupos.aprobado_cartera.push(p)
      else if (p.estado === 'en_preparacion') grupos.en_preparacion.push(p)
      else if (p.estado === 'listo_para_despacho') grupos.listo_para_despacho.push(p)
      else if (p.estado === 'despachado') grupos.despachado.push(p)
    })
    return grupos
  }, [pedidosFiltrados])

  const toggleMes = (key: string) => {
    setMesesAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const quitarFiltro = (campo: keyof FiltrosValores) => {
    setFiltros(prev => ({ ...prev, [campo]: campo === 'busqueda' ? '' : 'todos' }))
  }

  const pedidoActual = pedidos.find(p => p.id === pedidoAbierto) || null
  const pedidoRechazando = pedidos.find(p => p.id === modalRechazar) || null

  const renderAcciones = (pedido: Pedido) => {
    const cargando = procesando === pedido.id

    if (pedido.estado === 'aprobado_cartera') {
      return [
        <button key="rechazar" onClick={(e) => { e.stopPropagation(); iniciarRechazo(pedido.id) }} disabled={cargando} className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 active:scale-[0.95] disabled:opacity-50 transition-all shrink-0">
          <XCircleIcon className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium">Rechazar</span>
        </button>,
        <button key="aceptar" onClick={(e) => { e.stopPropagation(); handleAceptar(pedido.id) }} disabled={cargando} className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0">
          {cargando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircleIcon className="w-4 h-4" /><span className="hidden sm:inline text-xs font-semibold">Aceptar</span></>}
        </button>,
      ]
    }

    if (pedido.estado === 'en_preparacion') {
      return [
        <button key="listo" onClick={(e) => { e.stopPropagation(); handleMarcarListo(pedido.id) }} disabled={cargando} className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0">
          {cargando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ArrowRightIcon className="w-4 h-4" /><span className="hidden sm:inline text-xs font-semibold">Marcar listo</span></>}
        </button>,
      ]
    }

    if (pedido.estado === 'listo_para_despacho') {
      return [
        <button key="despachar" onClick={(e) => { e.stopPropagation(); handleDespachar(pedido) }} disabled={cargando} className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0">
          {cargando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><TruckIcon className="w-4 h-4" /><span className="hidden sm:inline text-xs font-semibold">Despachar</span></>}
        </button>,
      ]
    }

    if (pedido.estado === 'despachado') {
      return [
        <button key="entregar" onClick={(e) => { e.stopPropagation(); handleMarcarEntregado(pedido.id) }} disabled={cargando} className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0">
          {cargando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ArchiveBoxIcon className="w-4 h-4" /><span className="hidden sm:inline text-xs font-semibold">Entregar</span></>}
        </button>,
      ]
    }

    return undefined
  }

  const SECCIONES = [
    { key: 'aprobado_cartera', titulo: 'Nuevos — aprobados por cartera', descripcion: 'Confirma si puedes preparar el pedido', icono: ClipboardDocumentListIcon, color: 'text-blue-700' },
    { key: 'en_preparacion', titulo: 'En preparación', descripcion: 'Alistando el pedido', icono: ArrowRightIcon, color: 'text-amber-700' },
    { key: 'listo_para_despacho', titulo: 'Listos para despacho', descripcion: 'Terminados, listos para salir', icono: CheckCircleIcon, color: 'text-emerald-700' },
    { key: 'despachado', titulo: 'Despachados', descripcion: 'En camino al cliente', icono: TruckIcon, color: 'text-violet-700' },
  ] as const

  return (
    <div className="min-h-screen bg-[#F7F7FB] w-full">
      <header className="sticky top-[calc(var(--main-padding)*-1)] -mx-[var(--main-padding)] -mt-[var(--main-padding)] z-20 bg-white border-b border-gray-100">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#232323]">Pedidos</h1>
            <p className="text-sm text-[#828282] truncate mt-0.5">{tiendaActual?.nombre}</p>
          </div>
          <button onClick={() => setFiltrosAbiertos(true)} className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#1A0087] text-white rounded-xl text-sm font-semibold hover:bg-[#130066] active:scale-[0.98] transition-all shadow-sm min-h-[44px]">
            <FunnelIcon className="w-4 h-4" />Filtros
          </button>
        </div>

        {errorAccion && (
          <div className="border-t border-red-100 bg-red-50">
            <div className="w-full px-4 sm:px-6 py-2 text-sm text-red-700 flex items-center justify-between gap-3">
              <span>❌ {errorAccion}</span>
              <button onClick={() => setErrorAccion('')} className="text-red-700 hover:text-red-900 text-xs font-medium">Cerrar</button>
            </div>
          </div>
        )}

        {(filtros.busqueda.trim() || filtros.estado !== 'todos' || filtros.extra !== 'todos') && (
          <div className="border-t border-gray-100 bg-white">
            <div className="w-full px-4 sm:px-6 py-3">
              <FiltrosChips
                valores={filtros}
                onQuitar={quitarFiltro}
                onLimpiar={() => setFiltros(FILTROS_INICIALES)}
                extraLabel="Vendedor"
                extraOpciones={vendedoresUnicos}
                estadosDisponibles={ESTADOS_POR_ROL.bodeguero}
              />
            </div>
          </div>
        )}
      </header>

      <main className="w-full px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" /></div>
        ) : pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <ClipboardDocumentListIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[#828282]">No hay pedidos pendientes de acción</p>
          </div>
        ) : (
          <div className="space-y-6">
            {SECCIONES.map(sec => {
              const items = porEstado[sec.key]
              if (items.length === 0) return null
              const Icono = sec.icono
              return (
                <section key={sec.key}>
                  <div className="flex items-center gap-3 mb-3">
                    <Icono className={`w-5 h-5 ${sec.color}`} />
                    <h2 className={`text-lg font-bold ${sec.color}`}>{sec.titulo}</h2>
                    <span className="text-sm font-semibold bg-gray-100 text-gray-700 px-3 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <p className="text-xs text-[#828282] mb-3">{sec.descripcion}</p>
                  <div className="space-y-3">
                    {items.map(p => (
                      <PedidoCardCompacta key={p.id} pedido={p} onClick={() => setPedidoAbierto(p.id)} acciones={renderAcciones(p)} esAdmin={rolActual === 'admin'} />
                    ))}
                  </div>
                </section>
              )
            })}
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
        estadosDisponibles={ESTADOS_POR_ROL.bodeguero}
      />

      {pedidoActual && (
        <PedidoDetalleModal
          pedido={pedidoActual}
          onClose={() => setPedidoAbierto(null)}
          onRefresh={fetchOrders}
          rolActual="bodeguero"
          onVerCotizacion={(id) => { setPedidoAbierto(null); setVerCotizacion(id) }}
        />
      )}

      {verCotizacion && <CotizacionPreview pedidoId={verCotizacion} onClose={() => setVerCotizacion(null)} />}

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
                  <p className="text-xs text-[#828282] mt-0.5">Indica el motivo del rechazo</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800">
                <p className="font-semibold mb-2">⚠️ ¿Qué va a pasar?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>El pedido quedará en estado <strong>rechazado por bodega</strong></li>
                  <li>Se registra el motivo en el historial</li>
                  <li>El admin podrá revisarlo y decidir</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#232323] mb-2">Motivo del rechazo <span className="text-red-500">*</span></label>
                <textarea value={motivoRechazo} onChange={(e) => { setMotivoRechazo(e.target.value); setErrorRechazo('') }} placeholder="Ej: Productos sin stock, cliente con problemas, cantidades incorrectas..." rows={3} disabled={procesando === pedidoRechazando.id} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none" />
                <p className="text-[10px] text-[#828282] mt-1">{motivoRechazo.trim().length} / 10 caracteres mínimo</p>
              </div>

              {errorRechazo && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{errorRechazo}</div>}
            </div>

            <div className="border-t border-gray-100 p-4 flex flex-col-reverse sm:flex-row gap-2">
              <button onClick={() => setModalRechazar(null)} disabled={procesando === pedidoRechazando.id} className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 disabled:opacity-50 min-h-[48px]">Cancelar</button>
              <div className="hidden sm:block flex-1" />
              <button onClick={confirmarRechazo} disabled={procesando === pedidoRechazando.id || motivoRechazo.trim().length < 10} className="w-full sm:w-auto px-5 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] transition-all">
                {procesando === pedidoRechazando.id ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Rechazando...</>
                ) : (
                  <><XCircleIcon className="w-5 h-5" />Confirmar rechazo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}