'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import {
  CubeIcon, ArrowTrendingUpIcon, ExclamationTriangleIcon, 
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline'

const formatNum = (value: number) => new Intl.NumberFormat('es-CO').format(value)

export default function EstadisticasPage() {
  const { tiendaActual } = useTienda()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('30')

  const [kpis, setKpis] = useState({
    totalProductos: 0,
    unidadesDisponibles: 0,
    bajoMinimo: 0,
    agotados: 0,
    movimientosPeriodo: 0
  })
  const [stockPorCategoria, setStockPorCategoria] = useState<any[]>([])
  const [movimientosPorDia, setMovimientosPorDia] = useState<any[]>([])
  const [totalMovimientos, setTotalMovimientos] = useState({ entradas: 0, salidas: 0, transferencias: 0 })
  const [ultimoCorteInfo, setUltimoCorteInfo] = useState<any>(null)
  const [pedidosAtencion, setPedidosAtencion] = useState<any[]>([])
  const [actividadReciente, setActividadReciente] = useState<any[]>([])
  const [productosMayorMov, setProductosMayorMov] = useState<any[]>([])

  const fetchEstadisticas = useCallback(async () => {
    if (!tiendaActual) return
    setLoading(true)

    try {
      // 1. KPIs
      const { data: inventario } = await supabase
        .from('inventario')
        .select('cantidad_disponible, cantidad_minima')
        .eq('bodega_id', tiendaActual.id)

      let totalProd = 0, unidades = 0, bajoMin = 0, agotados = 0
      inventario?.forEach((item: any) => {
        totalProd++
        unidades += item.cantidad_disponible || 0
        if (item.cantidad_disponible <= 0) agotados++
        else if (item.cantidad_disponible < item.cantidad_minima) bajoMin++
      })
      setKpis({ totalProductos: totalProd, unidadesDisponibles: unidades, bajoMinimo: bajoMin, agotados: agotados, movimientosPeriodo: 0 })

      // 2. Stock por categoría (Si tienes categorías como FK, cambia el select)
      const { data: invCategorias } = await supabase
        .from('inventario')
        .select('cantidad_disponible, productos(categoria, color)')
        .eq('bodega_id', tiendaActual.id)

      const catMap: Record<string, number> = {}
      invCategorias?.forEach((i: any) => {
        const cat = i.productos?.categoria || 'OTROS'
        catMap[cat] = (catMap[cat] || 0) + (i.cantidad_disponible || 0)
      })
      setStockPorCategoria(Object.entries(catMap).map(([categoria, cantidad]) => ({ categoria, cantidad })).sort((a, b) => b.cantidad - a.cantidad))

      // 3. Movimientos
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - parseInt(periodo))

      const { data: movimientos } = await supabase
        .from('movimientos')
        .select('tipo, cantidad, fecha, productos(nombre)')
        .or(`bodega_origen_id.eq.${tiendaActual.id},bodega_destino_id.eq.${tiendaActual.id}`)
        .gte('fecha', fechaInicio.toISOString())
        .order('fecha', { ascending: false })

      let entradas = 0, salidas = 0, transferencias = 0
      const movsDiaMap: Record<string, any> = {}
      movimientos?.forEach((m: any) => {
        const dia = new Date(m.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
        if (!movsDiaMap[dia]) movsDiaMap[dia] = { dia, Entradas: 0, Salidas: 0, Transferencias: 0 }
        if (m.tipo === 'entrada') { entradas += m.cantidad; movsDiaMap[dia].Entradas += m.cantidad }
        if (m.tipo === 'salida') { salidas += m.cantidad; movsDiaMap[dia].Salidas += m.cantidad }
        if (m.tipo === 'transferencia') { transferencias += m.cantidad; movsDiaMap[dia].Transferencias += m.cantidad }
      })

      setTotalMovimientos({ entradas, salidas, transferencias })
      setMovimientosPorDia(Object.values(movsDiaMap))
      setKpis(prev => ({ ...prev, movimientosPeriodo: movimientos?.length || 0 }))

      // 4. Último corte
      const { data: corte } = await supabase
        .from('cortes')
        .select('*')
        .eq('bodega_id', tiendaActual.id)
        .order('fecha', { ascending: false })
        .limit(1)
        .single()

      if (corte) {
        const { data: detalles } = await supabase
          .from('detalle_cortes')
          .select('diferencia')
          .eq('corte_id', corte.id)

        let faltantes = 0, sobrantes = 0, sinDif = 0
        detalles?.forEach((d: any) => {
          if (d.diferencia < 0) faltantes += Math.abs(d.diferencia)
          else if (d.diferencia > 0) sobrantes += d.diferencia
          else sinDif++
        })
        setUltimoCorteInfo({ ...corte, faltantes, sobrantes, sinDif })
      } else {
        setUltimoCorteInfo(null)
      }

      // 5. Productos con mayor movimiento
      const { data: topMovs } = await supabase
        .from('movimientos')
        .select('productos(nombre), cantidad')
        .or(`bodega_origen_id.eq.${tiendaActual.id},bodega_destino_id.eq.${tiendaActual.id}`)
        .gte('fecha', fechaInicio.toISOString())

      const prodMap: Record<string, number> = {}
      topMovs?.forEach((m: any) => {
        const nombre = m.productos?.nombre || 'Producto'
        prodMap[nombre] = (prodMap[nombre] || 0) + m.cantidad
      })
      setProductosMayorMov(Object.entries(prodMap).map(([nombre, movimientos]) => ({ nombre, movimientos })).sort((a, b) => b.movimientos - a.movimientos).slice(0, 5))

      // 6. Pedidos que requieren atención
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, estado, fecha')
        .eq('bodega_id', tiendaActual.id)
        .in('estado', ['pendiente', 'aprobado_bodega', 'por_despachar'])
        .order('fecha', { ascending: true })
        .limit(5)
      setPedidosAtencion(pedidos || [])

      // 7. Actividad reciente
      const { data: actividad } = await supabase
        .from('movimientos')
        .select('tipo, cantidad, fecha, productos(nombre)')
        .or(`bodega_origen_id.eq.${tiendaActual.id},bodega_destino_id.eq.${tiendaActual.id}`)
        .order('fecha', { ascending: false })
        .limit(6)
      setActividadReciente(actividad || [])

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [tiendaActual?.id, periodo])

  useEffect(() => {
    if (!tiendaActual) return
    fetchEstadisticas()
  }, [fetchEstadisticas])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estadísticas</h1>
          <p className="text-sm text-gray-500">{tiendaActual?.nombre}</p>
        </div>
        <div className="mt-4 sm:mt-0 bg-white rounded-lg shadow p-1 flex gap-1">
          {['7', '30', '90'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                periodo === p ? 'bg-[#1A0087] text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p} días
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-50"><CubeIcon className="w-6 h-6 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Productos</p>
                <p className="text-2xl font-bold">{formatNum(kpis.totalProductos)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-50"><ArrowTrendingUpIcon className="w-6 h-6 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Unidades</p>
                <p className="text-2xl font-bold">{formatNum(kpis.unidadesDisponibles)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-yellow-100 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-50"><ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Bajo Mínimo</p>
                <p className="text-2xl font-bold text-yellow-600">{formatNum(kpis.bajoMinimo)}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-50"><ClipboardDocumentCheckIcon className="w-6 h-6 text-red-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Agotados</p>
                <p className="text-2xl font-bold text-red-600">{formatNum(kpis.agotados)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4">Stock por Categoría</h2>
            {stockPorCategoria.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stockPorCategoria} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="categoria" type="category" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Unidades" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4">Movimientos ({periodo} días)</h2>
            <div className="flex justify-between mb-4">
              <span className="text-sm text-green-600">🟢 Entradas: {formatNum(totalMovimientos.entradas)}</span>
              <span className="text-sm text-red-600">🔴 Salidas: {formatNum(totalMovimientos.salidas)}</span>
              <span className="text-sm text-blue-600">🔵 Transf: {formatNum(totalMovimientos.transferencias)}</span>
            </div>
            {movimientosPorDia.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin movimientos recientes</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={movimientosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Entradas" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Salidas" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Transferencias" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-4">📋 Último Corte</h2>
              {ultimoCorteInfo ? (
                <>
                  <p className="text-sm text-gray-500">
                    Fecha: <span className="font-semibold text-gray-700">{new Date(ultimoCorteInfo.fecha).toLocaleDateString('es-CO')}</span>
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-xl font-bold text-red-600">{formatNum(ultimoCorteInfo.faltantes)}</p>
                      <p className="text-xs text-gray-500">Faltantes</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-xl font-bold text-green-600">{formatNum(ultimoCorteInfo.sobrantes)}</p>
                      <p className="text-xs text-gray-500">Sobrantes</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xl font-bold text-blue-600">{formatNum(ultimoCorteInfo.sinDif)}</p>
                      <p className="text-xs text-gray-500">Sin Dif.</p>
                    </div>
                  </div>
                  <Link href="/admin/cortes" className="mt-4 inline-block text-sm text-[#1A0087] font-medium hover:underline">
                    Ver detalles del corte →
                  </Link>
                </>
              ) : (
                <p className="text-gray-400 text-sm">Sin cortes registrados</p>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-4">🔥 Productos con mayor movimiento</h2>
              {productosMayorMov.length === 0 ? (
                <p className="text-gray-400 text-sm">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {productosMayorMov.map((p, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{p.nombre}</span>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded">{p.movimientos} mov.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-4">📦 Pedidos que requieren atención</h2>
              <div className="space-y-2">
                {pedidosAtencion.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin pedidos pendientes</p>
                ) : (
                  pedidosAtencion.map(p => (
                    <div key={p.id} className="flex justify-between items-center border-b pb-2">
                      <p className="text-sm font-medium text-gray-700">Pedido #{p.id.slice(0, 8)}</p>
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-100 text-yellow-700">
                        {p.estado.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 mb-4">⚡ Actividad Reciente</h2>
              <div className="relative border-l-2 border-gray-200 ml-3 space-y-4">
                {actividadReciente.map((act, i) => (
                  <div key={i} className="relative pl-6">
                    <div className={`absolute -left-[7px] top-0 w-3 h-3 rounded-full border-2 border-white ${
                      act.tipo === 'entrada' ? 'bg-green-500' : act.tipo === 'salida' ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                    <p className="text-sm text-gray-700 font-medium">
                      {act.tipo === 'entrada' ? '🟢 Entrada' : act.tipo === 'salida' ? '🔴 Salida' : '🔵 Transferencia'} de {act.cantidad} unid.
                    </p>
                    <p className="text-xs text-gray-400">{act.productos?.nombre}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(act.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}