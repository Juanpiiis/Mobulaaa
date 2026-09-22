'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { Cliente, PedidoHistorial } from '@/types/clientes'

interface Props {
  cliente: Cliente
  onClose: () => void
}

const estadoLabel: Record<string, string> = {
  pendiente: 'En revisión',
  aprobado_bodega: 'Aprobado bodega',
  rechazado_bodega: 'Rechazado bodega',
  aprobado_cartera: 'Aprobado cartera',
  rechazado_cartera: 'Rechazado cartera',
  despachado: 'Despachado',
  entregado: 'Entregado',
}

export function HistorialClienteModal({ cliente, onClose }: Props) {
  const supabase = createClient()
  const [pedidos, setPedidos] = useState<PedidoHistorial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('id, fecha, estado, total, numero_factura')
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false })
        .limit(20)
      setPedidos((data as PedidoHistorial[]) || [])
      setLoading(false)
    }
    fetch()
  }, [cliente.id, supabase])

  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <div>
            <h2 className="font-bold text-[#232323]">{cliente.nombre}</h2>
            <p className="text-xs text-gray-500">CC/NIT: {cliente.cc_nit}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Cargando historial…</p>
          ) : pedidos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin pedidos registrados</p>
          ) : (
            <div className="space-y-3">
              {pedidos.map((p) => (
                <div key={p.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-[#232323]">
                        {p.numero_factura || `#${p.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.fecha).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#232323]">{formatCOP(p.total)}</p>
                      <p className="text-xs text-gray-500">{estadoLabel[p.estado] || p.estado}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}