'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTienda } from '@/lib/context/TiendaContext'
import Link from 'next/link'
import { formatDateShort, formatNum } from '@/lib/utils/dataExcel'
import {
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline'

interface Corte {
  id: string
  bodega_id: string
  fecha: string
  estado: string
  observaciones: string | null
}

export default function ConteoPage() {
  const { tiendaActual } = useTienda()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [cortes, setCortes] = useState<Corte[]>([])
  const [detalles, setDetalles] = useState<Record<string, { faltantes: number, sobrantes: number, sinDif: number, total: number }>>({})

  const fetchCortes = async () => {
    if (!tiendaActual) return
    setLoading(true)

    try {
      const { data: cortesData } = await supabase
        .from('cortes')
        .select('*')
        .eq('bodega_id', tiendaActual.id)
        .order('fecha', { ascending: false })

      setCortes(cortesData || [])

      // Para cada corte, calcular las diferencias
      const detallesMap: Record<string, any> = {}
      for (const corte of cortesData || []) {
        const { data: detalleData } = await supabase
          .from('detalle_cortes')
          .select('diferencia')
          .eq('corte_id', corte.id)

        let faltantes = 0, sobrantes = 0, sinDif = 0
        detalleData?.forEach((d: any) => {
          if (d.diferencia < 0) faltantes += Math.abs(d.diferencia)
          else if (d.diferencia > 0) sobrantes += d.diferencia
          else sinDif++
        })

        detallesMap[corte.id] = { faltantes, sobrantes, sinDif, total: detalleData?.length || 0 }
      }
      setDetalles(detallesMap)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!tiendaActual) return
    fetchCortes()
  }, [tiendaActual?.id])

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Conteo de Inventario</h1>
          <p className="text-sm text-gray-500">{tiendaActual?.nombre}</p>
        </div>
        <Link
          href="/admin/subir-inventario"
          className="flex items-center gap-2 bg-[#1A0087] text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-[#15006b] transition-colors"
        >
          <ClipboardDocumentCheckIcon className="w-5 h-5" />
          Subir nuevo conteo
        </Link>
      </div>

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
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Total revisados</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Faltantes</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Sobrantes</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Sin diferencia</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cortes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <BuildingStorefrontIcon className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No hay cortes registrados</p>
                      <p className="text-gray-400 text-sm">Sube tu primer conteo de inventario</p>
                    </div>
                  </td>
                </tr>
              ) : (
                cortes.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{formatDateShort(c.fecha)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {c.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatNum(detalles[c.id]?.total || 0)}</td>
                    <td className="px-6 py-4">
                      <span className="text-red-600 font-semibold">{formatNum(detalles[c.id]?.faltantes || 0)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-green-600 font-semibold">{formatNum(detalles[c.id]?.sobrantes || 0)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-blue-600 font-semibold">{formatNum(detalles[c.id]?.sinDif || 0)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/conteo/${c.id}`}
                        className="text-sm text-[#1A0087] font-medium hover:underline"
                      >
                        Ver detalle
                      </Link>
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