'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FiltrosStats } from '../queries/types'
import { tiempoAprobacion, tiempoDespachoEntrega, pendientesAntiguos } from '../queries/pedidos'
import { ChartCard } from '../ChartCard'
import { KpiCard } from '../KpiCard'

export function PedidosTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>({})

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [aprob, tiempos, pend] = await Promise.all([
                    tiempoAprobacion(sb, filtros),
                    tiempoDespachoEntrega(sb, filtros),
                    pendientesAntiguos(sb, filtros),
                ])
                setData({ aprob, tiempos, pend })
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando pedidos…</p>

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard label="Aprobación promedio" value={`${(data.aprob?.promedioHoras || 0).toFixed(1)} h`} color="blue" sub={`${data.aprob?.muestras ?? 0} pedidos`} />
                <KpiCard label="Aprobación → Despacho" value={`${(data.tiempos?.aprobacionDespacho || 0).toFixed(1)} días`} color="purple" />
                <KpiCard label="Despacho → Entrega" value={`${(data.tiempos?.despachoEntrega || 0).toFixed(1)} días`} color="green" />
            </div>

            <ChartCard title="Pedidos pendientes más antiguos" empty={data.pend?.length === 0}>
                <div className="max-h-80 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                            <tr><th className="text-left">Pedido</th><th className="text-left">Estado</th><th className="text-left">Cliente</th><th className="text-left">Vendedor</th><th className="text-right">Días</th></tr>
                        </thead>
                        <tbody>
                            {data.pend?.map((p: any) => (
                                <tr key={p.id} className="border-b border-gray-50">
                                    <td className="py-1.5">#{p.id.slice(0, 8)}</td>
                                    <td><span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">{p.estado}</span></td>
                                    <td>{p.cliente}</td>
                                    <td>{p.vendedor}</td>
                                    <td className="text-right font-semibold">{p.dias}d</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChartCard>
        </div>
    )
}