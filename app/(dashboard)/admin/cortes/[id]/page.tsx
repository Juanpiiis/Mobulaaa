'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDateShort, formatNum } from '@/lib/utils/dataExcel'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function DetalleConteoPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [detalles, setDetalles] = useState<any[]>([])
  const [corte, setCorte] = useState<any>(null)

  useEffect(() => {
    const fetchDetalle = async () => {
      if (!id) return
      try {
        const { data: corteData } = await supabase
          .from('cortes')
          .select('*')
          .eq('id', id)
          .single()
        setCorte(corteData)

        const { data: detalleData } = await supabase
          .from('detalle_cortes')
          .select('*, productos(nombre, color, modelo)')
          .eq('corte_id', id)
        setDetalles(detalleData || [])
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchDetalle()
  }, [id])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/conteo" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Detalle del Conteo</h1>
          <p className="text-sm text-gray-500">{corte ? formatDateShort(corte.fecha) : 'Cargando...'}</p>
        </div>
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
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Sistema</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Físico</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Diferencia</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Observación</th>
              </tr>
            </thead>
            <tbody>
              {detalles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Sin datos para este corte</p>
                  </td>
                </tr>
              ) : (
                detalles.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{d.productos?.nombre}</p>
                      <p className="text-xs text-gray-500">{d.productos?.modelo} {d.productos?.color}</p>
                    </td>
                    <td className="px-6 py-4">{formatNum(d.cantidad_sistema)}</td>
                    <td className="px-6 py-4">{formatNum(d.cantidad_fisica)}</td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${d.diferencia < 0 ? 'text-red-600' : d.diferencia > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatNum(d.diferencia)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-600">{d.observacion || '—'}</span>
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