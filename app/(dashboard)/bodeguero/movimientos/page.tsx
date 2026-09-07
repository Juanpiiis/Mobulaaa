'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import { formatDateShort, formatNum } from '@/lib/utils/dataExcel'
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Movimiento {
  id: string
  tipo: string
  cantidad: number
  fecha: string
  productos: { nombre: string } | null
  bodega_origen_id: string | null
  bodega_destino_id: string | null
}

export default function MovimientosPage() {
  const { tiendaActual } = useTienda()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [totalEntradas, setTotalEntradas] = useState(0)
  const [totalSalidas, setTotalSalidas] = useState(0)
  const [totalTransferencias, setTotalTransferencias] = useState(0)
  const [periodo, setPeriodo] = useState('30')

  const fetchMovimientos = async () => {
    if (!tiendaActual) return
    setLoading(true)

    try {
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - parseInt(periodo))

      const { data } = await supabase
        .from('movimientos')
        .select('*')
        .or(`bodega_origen_id.eq.${tiendaActual.id},bodega_destino_id.eq.${tiendaActual.id}`)
        .gte('fecha', fechaInicio.toISOString())
        .order('fecha', { ascending: false })
        .limit(50)

      setMovimientos(data || [])

      // Calcular totales
      let entradas = 0, salidas = 0, transferencias = 0
      ;(data || []).forEach((m: any) => {
        if (m.tipo === 'entrada') entradas += m.cantidad
        if (m.tipo === 'salida') salidas += m.cantidad
        if (m.tipo === 'transferencia') transferencias += m.cantidad
      })
      setTotalEntradas(entradas)
      setTotalSalidas(salidas)
      setTotalTransferencias(transferencias)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!tiendaActual) return
    fetchMovimientos()
  }, [tiendaActual?.id, periodo])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Movimientos</h1>
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

      {/* Totales */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-50">
            <ArrowDownTrayIcon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Entradas</p>
            <p className="text-2xl font-bold text-green-600">{formatNum(totalEntradas)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-50">
            <ArrowUpTrayIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Salidas</p>
            <p className="text-2xl font-bold text-red-600">{formatNum(totalSalidas)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50">
            <ArrowsRightLeftIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Transferencias</p>
            <p className="text-2xl font-bold text-blue-600">{formatNum(totalTransferencias)}</p>
          </div>
        </div>
      </div>

      {/* Lista de movimientos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <ClockIcon className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">Sin movimientos recientes</p>
                      <p className="text-gray-400 text-sm">No hay registros en el período seleccionado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                movimientos.map(m => (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">{formatDateShort(m.fecha)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        m.tipo === 'entrada' ? 'bg-green-100 text-green-700' :
                        m.tipo === 'salida' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {m.tipo === 'entrada' ? <ArrowDownTrayIcon className="w-3 h-3" /> :
                         m.tipo === 'salida' ? <ArrowUpTrayIcon className="w-3 h-3" /> :
                         <ArrowsRightLeftIcon className="w-3 h-3" />}
                        {m.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">{m.productos?.nombre || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${
                        m.tipo === 'entrada' ? 'text-green-600' :
                        m.tipo === 'salida' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {formatNum(m.cantidad)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}