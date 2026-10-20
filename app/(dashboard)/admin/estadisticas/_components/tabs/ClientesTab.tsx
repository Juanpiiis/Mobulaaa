'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FiltrosStats } from '../queries/types'
import { clientesMasActivos, clientesInactivos, concentracionVentas } from '../queries/clientes'
import { ChartCard } from '../ChartCard'
import { KpiCard } from '../KpiCard'

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export function ClientesTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>({})

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [activos, inactivos, conc] = await Promise.all([
                    clientesMasActivos(sb, filtros),
                    clientesInactivos(sb, filtros),
                    concentracionVentas(sb, filtros),
                ])
                setData({ activos, inactivos, conc })
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando clientes…</p>

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard label="Clientes activos (periodo)" value={data.activos?.length ?? 0} color="green" />
                <KpiCard label="Clientes inactivos (+60d)" value={data.inactivos?.length ?? 0} color="yellow" />
                <KpiCard label="Top 5 concentración" value={`${(data.conc?.pct || 0).toFixed(1)}%`} sub={fmtMoney(data.conc?.top5Total || 0)} color="purple" />
            </div>

            <ChartCard title="Top 15 clientes más activos" empty={data.activos?.length === 0}>
                <div className="max-h-80 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                            <tr><th className="text-left">Cliente</th><th className="text-left">NIT</th><th className="text-right">Pedidos</th><th className="text-right">Total</th></tr>
                        </thead>
                        <tbody>
                            {data.activos?.map((c: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="py-1.5">{c.nombre}</td>
                                    <td>{c.nit}</td>
                                    <td className="text-right">{c.pedidos}</td>
                                    <td className="text-right">{fmtMoney(c.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChartCard>

            <ChartCard title="Clientes inactivos (+60 días sin compra)" empty={data.inactivos?.length === 0}>
                <div className="max-h-64 overflow-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {data.inactivos?.map((c: any) => (
                        <div key={c.id} className="flex justify-between text-sm border-b border-gray-50 py-1">
                            <span className="text-gray-700 truncate">{c.nombre}</span>
                            <span className="text-gray-400 text-xs">{c.nit}</span>
                        </div>
                    ))}
                </div>
            </ChartCard>
        </div>
    )
}