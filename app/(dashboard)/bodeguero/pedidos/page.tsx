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
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
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

export default function PedidosBodegueroPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [rolActual, setRolActual] = useState<string | null>(null)
  const [pedidoAbierto, setPedidoAbierto] = useState<string | null>(null)
  const [abrirEnEdicion, setAbrirEnEdicion] = useState(false)
  const [verCotizacion, setVerCotizacion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)

  const [modalDespacho, setModalDespacho] = useState<string | null>(null)
  const [cantidadesDespacho, setCantidadesDespacho] = useState<Record<string, number>>({})

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

  const handleAprobarBodega = async (pedidoId: string) => {
    if (procesando) return
    setProcesando(pedidoId)
    const { error } = await supabase.from('pedidos').update({ estado: 'aprobado_bodega' }).eq('id', pedidoId)
    if (!error) {
      const { registrarCambioHistorial } = await import('@/lib/utils/historial')
      await registrarCambioHistorial({
        pedidoId,
        accion: 'aprobado_bodega',
        estadoAnterior: 'pendiente',
        estadoNuevo: 'aprobado_bodega',
        observacion: 'Pedido aprobado por bodega',
      })
    }
    setProcesando(null)
    fetchOrders()
  }

  const handleRechazarBodega = async (pedidoId: string) => {
    if (procesando) return
    setProcesando(pedidoId)
    const { error } = await supabase.from('pedidos').update({ estado: 'rechazado_bodega' }).eq('id', pedidoId)
    if (!error) {
      const { registrarCambioHistorial } = await import('@/lib/utils/historial')
      await registrarCambioHistorial({
        pedidoId,
        accion: 'rechazado_bodega',
        estadoAnterior: 'pendiente',
        estadoNuevo: 'rechazado_bodega',
        observacion: 'Pedido rechazado por bodega',
      })
    }
    setProcesando(null)
    fetchOrders()
  }

  const iniciarDespacho = (pedido: Pedido) => {
    const inicial: Record<string, number> = {}
    pedido.detalle_pedido.forEach(d => {
      inicial[d.id] = d.cantidad_aprobada ?? d.cantidad_solicitada
    })
    setCantidadesDespacho(inicial)
    setModalDespacho(pedido.id)
  }

  const confirmarDespacho = async (pedido: Pedido) => {
    if (procesando) return
    setProcesando(pedido.id)
    const { data: { user } } = await supabase.auth.getUser()

    for (const d of pedido.detalle_pedido) {
      const cantidad = cantidadesDespacho[d.id] || 0
      await supabase.from('detalle_pedido').update({ cantidad_aprobada: cantidad }).eq('id', d.id)

      if (cantidad > 0) {
        await supabase.from('movimientos').insert({
          producto_id: d.productos.id,
          bodega_origen_id: pedido.bodegas?.id,
          cantidad,
          tipo: 'salida',
          usuario_id: user?.id,
          fecha: new Date().toISOString(),
          observacion: `Despacho ${pedido.numero_factura || String(pedido.id).slice(0, 8)}`,
        })
        const { data: inv } = await supabase
          .from('inventario')
          .select('id, cantidad_disponible')
          .eq('producto_id', d.productos.id)
          .eq('bodega_id', pedido.bodegas?.id)
          .single()
        if (inv) {
          await supabase
            .from('inventario')
            .update({ cantidad_disponible: Math.max(0, inv.cantidad_disponible - cantidad) })
            .eq('id', inv.id)
        }
      }
    }

    await supabase.from('pedidos').update({ estado: 'despachado', revertido: false }).eq('id', pedido.id)

    const { registrarCambioHistorial } = await import('@/lib/utils/historial')
    await registrarCambioHistorial({
      pedidoId: pedido.id,
      accion: 'despachado',
      estadoAnterior: 'aprobado_cartera',
      estadoNuevo: 'despachado',
      observacion: pedido.revertido
        ? `Re-despacho después de reversión (${pedido.detalle_pedido.length} productos)`
        : `Despacho de ${pedido.detalle_pedido.length} productos`,
    })

    setProcesando(null)
    setModalDespacho(null)
    fetchOrders()
  }

  const marcarEntregado = async (pedidoId: string) => {
    if (procesando) return
    setProcesando(pedidoId)
    await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', pedidoId)
    const { registrarCambioHistorial } = await import('@/lib/utils/historial')
    await registrarCambioHistorial({
      pedidoId,
      accion: 'entregado',
      estadoAnterior: 'despachado',
      estadoNuevo: 'entregado',
      observacion: 'Pedido entregado al cliente',
    })
    setProcesando(null)
    fetchOrders()
  }

  const toggleImportante = async (pedidoId: string, importante: boolean) => {
    if (procesando) return
    setProcesando(pedidoId)

    const { error } = await supabase
      .from('pedidos')
      .update({ importante })
      .eq('id', pedidoId)

    if (error) {
      console.error('Error marcando importante:', error)
      alert('No se pudo actualizar el pedido')
      setProcesando(null)
      return
    }

    const { registrarCambioHistorial } = await import('@/lib/utils/historial')
    await registrarCambioHistorial({
      pedidoId,
      accion: 'editado',
      observacion: importante
        ? 'Marcado como importante por el admin'
        : 'Desmarcado como importante por el admin',
    })

    setProcesando(null)
    fetchOrders()
  }

  const { enProcesoNormales, enProcesoRevertidos, devueltosPorCartera } = useMemo(() => {
    const proceso = pedidos.filter(p =>
      ['pendiente', 'aprobado_bodega', 'aprobado_cartera'].includes(p.estado)
    )
    const devueltos = pedidos.filter(p => p.estado === 'devuelto_por_cartera')

    const ordenar = (arr: Pedido[]) =>
      [...arr].sort((a, b) => {
        if (a.importante && !b.importante) return -1
        if (!a.importante && b.importante) return 1
        return new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      })

    return {
      enProcesoNormales: ordenar(proceso.filter(p => !p.revertido)),
      enProcesoRevertidos: ordenar(proceso.filter(p => p.revertido)),
      devueltosPorCartera: ordenar(devueltos),
    }
  }, [pedidos])

  const vendedoresUnicos = useMemo(() => {
    const set = new Set<string>()
    pedidos.forEach(p => { if (p.usuarios?.nombre) set.add(p.usuarios.nombre) })
    return Array.from(set).sort().map(v => ({ valor: v, etiqueta: v }))
  }, [pedidos])

  const historialFiltrado = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()
    return pedidos.filter(p => {
      if (!['despachado', 'entregado', 'rechazado_bodega', 'rechazado_cartera', 'cancelado'].includes(p.estado)) return false

      if (filtros.estado === 'pendiente' && p.estado !== 'pendiente') return false
      if (filtros.estado === 'aprobado' && !['aprobado_bodega', 'aprobado_cartera'].includes(p.estado)) return false
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
  const pedidoDespachando = pedidos.find(p => p.id === modalDespacho) || null

  const abrirDetalle = (id: string) => {
    setAbrirEnEdicion(false)
    setPedidoAbierto(id)
  }

  const abrirEdicion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setAbrirEnEdicion(true)
    setPedidoAbierto(id)
  }

  const renderAcciones = (pedido: Pedido) => {
    const btns: React.ReactNode[] = []
    const cargando = procesando === pedido.id

    if (pedido.estado === 'pendiente') {
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
        </button>,
        <button
          key="rechazar"
          onClick={() => handleRechazarBodega(pedido.id)}
          disabled={cargando}
          title="Rechazar"
          aria-label="Rechazar"
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 active:scale-[0.95] disabled:opacity-50 transition-all shrink-0"
        >
          <XCircleIcon className="w-4 h-4" />
        </button>,
        <button
          key="aprobar"
          onClick={() => handleAprobarBodega(pedido.id)}
          disabled={cargando}
          title="Aprobar"
          aria-label="Aprobar"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {cargando ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircleIcon className="w-4 h-4" />
          )}
        </button>
      )
    }

    if (pedido.estado === 'devuelto_por_cartera' && rolActual === 'admin') {
      btns.push(
        <button
          key="editar-devuelto"
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

    if (pedido.estado === 'aprobado_cartera') {
      btns.push(
        <button
          key="despachar"
          onClick={() => iniciarDespacho(pedido)}
          disabled={cargando}
          title={pedido.revertido ? 'Re-despachar' : 'Despachar'}
          aria-label={pedido.revertido ? 'Re-despachar' : 'Despachar'}
          className={`h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg text-white font-medium text-xs hover:brightness-110 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0 ${pedido.revertido ? 'bg-orange-600' : 'bg-blue-600'}`}
        >
          <TruckIcon className="w-4 h-4" />
          <span className="hidden sm:inline">
            {pedido.revertido ? 'Re-despachar' : 'Despachar'}
          </span>
        </button>
      )
    }

    if (pedido.estado === 'despachado') {
      btns.push(
        <button
          key="entregar"
          onClick={() => marcarEntregado(pedido.id)}
          disabled={cargando}
          title="Marcar entregado"
          aria-label="Entregar"
          className="h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg bg-gray-700 text-white font-medium text-xs hover:bg-gray-800 active:scale-[0.95] disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          <ArchiveBoxIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Entregar</span>
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

            {/* DEVUELTOS POR CARTERA */}
            {devueltosPorCartera.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <ArrowUturnLeftIcon className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-bold text-orange-700">
                    Devueltos por cartera
                  </h2>
                  <span className="text-sm font-semibold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full">
                    {devueltosPorCartera.length}
                  </span>
                </div>
                <div className="space-y-4 p-4 bg-orange-50/50 border border-orange-200 rounded-2xl">
                  {devueltosPorCartera.map(p => (
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
              </section>
            )}

            {/* EN PROCESO */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-[#232323]">🔥 En proceso</h2>
                <span className="text-sm font-semibold bg-yellow-100 text-yellow-800 px-3 py-0.5 rounded-full">
                  {enProcesoNormales.length + enProcesoRevertidos.length}
                </span>
              </div>

              {enProcesoNormales.length === 0 && enProcesoRevertidos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <ClipboardDocumentListIcon className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-[#828282]">No hay pedidos en proceso</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enProcesoNormales.map(p => (
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

              {enProcesoRevertidos.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <ArrowPathIcon className="w-5 h-5 text-orange-600" />
                    <h3 className="text-base font-bold text-orange-700">
                      Revertidos — revisar antes de despachar
                    </h3>
                    <span className="text-sm font-semibold bg-orange-100 text-orange-800 px-3 py-0.5 rounded-full">
                      {enProcesoRevertidos.length}
                    </span>
                  </div>
                  <div className="space-y-4 p-4 bg-orange-50/50 border border-orange-200 rounded-2xl">
                    {enProcesoRevertidos.map(p => (
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

      {/* FILTROS */}
      <FiltrosModal
        abierto={filtrosAbiertos}
        onClose={() => setFiltrosAbiertos(false)}
        valores={filtros}
        onAplicar={setFiltros}
        extraLabel="Vendedor"
        extraOpciones={vendedoresUnicos}
        placeholderBusqueda="Buscar por COT, factura, pedido, cliente o vendedor..."
      />

      {/* DETALLE */}
      {pedidoActual && (
        <PedidoDetalleModal
          pedido={pedidoActual}
          onClose={() => {
            setPedidoAbierto(null)
            setAbrirEnEdicion(false)
          }}
          onRefresh={fetchOrders}
          rolActual={rolActual}
          abrirEnModoEdicion={abrirEnEdicion}
          onVerCotizacion={(id) => {
            setPedidoAbierto(null)
            setAbrirEnEdicion(false)
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

      {/* MODAL DESPACHO */}
      {pedidoDespachando && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#232323]">
                {pedidoDespachando.revertido ? 'Re-despachar pedido' : 'Confirmar despacho'}
              </h3>
              <p className="text-sm text-[#828282] mt-1">
                Verifica las cantidades antes de despachar
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {pedidoDespachando.detalle_pedido.map(d => (
                <div key={d.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#232323] truncate">
                      {d.productos.nombre}
                    </p>
                    <p className="text-xs text-[#828282] mt-0.5">
                      Solicitado: {d.cantidad_solicitada}
                    </p>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cantidadesDespacho[d.id] ?? d.cantidad_solicitada}
                    onChange={e => {
                      const valor = e.target.value.replace(/\D/g, '')
                      const num = valor === '' ? 0 : parseInt(valor)
                      setCantidadesDespacho({
                        ...cantidadesDespacho,
                        [d.id]: Math.min(num, d.cantidad_solicitada),
                      })
                    }}
                    onFocus={e => e.target.select()}
                    className="w-20 border border-gray-300 rounded-xl p-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#1A0087]/30 focus:border-[#1A0087] min-h-[44px]"
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 p-4 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => setModalDespacho(null)}
                disabled={procesando === pedidoDespachando.id}
                className="w-full sm:w-auto px-5 py-3 border border-gray-200 rounded-xl text-sm font-medium text-[#232323] bg-white hover:bg-gray-50 min-h-[48px] disabled:opacity-50"
              >
                Cancelar
              </button>
              <div className="hidden sm:block flex-1" />
              <button
                onClick={() => confirmarDespacho(pedidoDespachando)}
                disabled={procesando === pedidoDespachando.id}
                className="w-full sm:w-auto px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px] transition-all"
              >
                {procesando === pedidoDespachando.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Despachando...
                  </>
                ) : (
                  <>
                    <TruckIcon className="w-5 h-5" />
                    Confirmar despacho
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