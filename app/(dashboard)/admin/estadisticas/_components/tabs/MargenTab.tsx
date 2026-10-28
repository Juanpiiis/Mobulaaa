'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FiltrosStats } from '../queries/types'
import { margenPorProducto, utilidadMes } from '../queries/margen'
import { KpiCard } from '../KpiCard'
import { ChartCard } from '../ChartCard'

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`

export function MargenTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>({})

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [prods, util] = await Promise.all([
                    margenPorProducto(sb, filtros),
                    utilidadMes(sb, filtros)
                ])
                setData({ prods, util })
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando márgenes…</p>

    const masRentables = data.prods?.slice(0, 5) || []
    const menosRentables = [...(data.prods || [])].sort((a, b) => a.margen - b.margen).slice(0, 5)

    return (
        <div className="space-y-4">
            {/* KPIs de Utilidad */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Ingreso Total (Ventas)" value={fmtMoney(data.util?.ingresoTotal || 0)} color="blue" />
                <KpiCard label="Costo Base (Mayorista)" value={fmtMoney(data.util?.costoTotal || 0)} color="red" />
                <KpiCard label="Ganancia Estimada" value={fmtMoney(data.util?.utilidad || 0)} color="green" />
                <KpiCard label="Margen Promedio" value={fmtPct(data.util?.margenPct || 0)} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top 5 Más Rentables */}
                <ChartCard title="Top 5 Más Rentables" empty={masRentables.length === 0}>
                    <div className="max-h-64 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                                <tr><th className="text-left">Producto</th><th className="text-right">Ganancia</th><th className="text-right">%</th></tr>
                            </thead>
                            <tbody>
                                {masRentables.map((p: any, i: number) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="py-1.5">{p.nombre}</td>
                                        <td className="text-right text-green-600">{fmtMoney(p.margen)}</td>
                                        <td className="text-right">{fmtPct(p.pct)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>

                {/* Top 5 Menos Rentables */}
                <ChartCard title="Top 5 Menos Rentables" empty={menosRentables.length === 0}>
                    <div className="max-h-64 overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                                <tr><th className="text-left">Producto</th><th className="text-right">Ganancia</th><th className="text-right">%</th></tr>
                            </thead>
                            <tbody>
                                {menosRentables.map((p: any, i: number) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="py-1.5">{p.nombre}</td>
                                        <td className="text-right text-red-600">{fmtMoney(p.margen)}</td>
                                        <td className="text-right">{fmtPct(p.pct)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </ChartCard>
            </div>
        </div>
    )
}