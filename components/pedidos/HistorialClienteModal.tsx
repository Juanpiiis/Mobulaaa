'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'
import type { Cliente } from '@/types/clientes'
import { PedidoCardCompacta } from './PedidoCardCompacta'

interface Props {
  cliente: Cliente
  onClose: () => void
}

interface PedidoHistorial {
  id: string
  estado: string
  fecha: string
  total: number
  numero_factura: string | null
  numero_cotizacion: string | null
  revertido: boolean
  usuarios: { nombre: string } | null
  clientes: { nombre: string; cc_nit: string } | null
  detalle_pedido: { cantidad_solicitada: number }[]
}

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

export function HistorialClienteModal({ cliente, onClose }: Props) {
  const [pedidos, setPedidos] = useState<PedidoHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [mesesAbiertos, setMesesAbiertos] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('pedidos')
        .select(`
                    id,
                    estado,
                    fecha,
                    total,
                    numero_factura,
                    numero_cotizacion,
                    revertido,
                    usuarios(nombre),
                    clientes(nombre, cc_nit),
                    detalle_pedido(cantidad_solicitada)
                `)
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false })
      setPedidos((data as any) || [])
      setLoading(false)
    }
    cargar()
  }, [cliente.id, supabase])

  const porMes = useMemo(() => {
    const grupos: Record<string, PedidoHistorial[]> = {}
    pedidos.forEach(p => {
      const key = getMesKey(p.fecha)
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(p)
    })
    return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a))
  }, [pedidos])

  // Abrir primer mes automáticamente
  useEffect(() => {
    if (porMes.length > 0) {
      setMesesAbiertos(prev => {
        const nuevo = { ...prev }
        if (Object.keys(nuevo).length === 0) {
          nuevo[porMes[0][0]] = true
        }
        return nuevo
      })
    }
  }, [porMes.length])

  const toggleMes = (key: string) => {
    setMesesAbiertos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const totalFacturado = pedidos
    .filter(p => ['despachado', 'entregado'].includes(p.estado))
    .reduce((acc, p) => acc + (p.total || 0), 0)

  const formatCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="shrink-0 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3 p-5">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-full bg-[#1A0087]/10 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-6 h-6 text-[#1A0087]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-[#232323] truncate">
                  {cliente.nombre}
                </h2>
                <p className="text-xs text-[#828282] mt-0.5">
                  CC/NIT: {cliente.cc_nit}
                </p>
                {cliente.telefono && (
                  <p className="text-xs text-[#828282] mt-0.5 flex items-center gap-1">
                    <PhoneIcon className="w-3 h-3" /> {cliente.telefono}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 active:bg-gray-200 transition-colors"
              aria-label="Cerrar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          {!loading && pedidos.length > 0 && (
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              <div className="bg-[#1A0087]/5 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[#828282] uppercase tracking-wide">
                  Pedidos totales
                </p>
                <p className="text-lg font-bold text-[#1A0087] mt-0.5">
                  {pedidos.length}
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-[#828282] uppercase tracking-wide">
                  Total facturado
                </p>
                <p className="text-lg font-bold text-green-700 mt-0.5 truncate">
                  {formatCOP(totalFacturado)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-[#F7F7FB]">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#1A0087] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pedidos.length === 0 ? (
            <div className="p-10 text-center">
              <ShoppingBagIcon className="w-14 h-14 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-[#828282]">
                Este cliente no tiene pedidos todavía
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {porMes.map(([mesKey, itemsMes]) => {
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
                    </button>

                    {abierto && (
                      <div className="p-3 pt-0 space-y-2">
                        {itemsMes.map(p => (
                          <PedidoCardCompacta
                            key={p.id}
                            pedido={p}
                            onClick={() => { }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}