'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import { FiltrosStats } from '../queries/types'
import {
    productosMasVendidos, categoriasMasVendidas, clasificacionABC, productosSinRotacion,
    sobrestock, agotadosConDemanda, nivelServicio, valorInventario,
} from '../queries/productos'
import { KpiCard } from '../KpiCard'
import { ChartCard } from '../ChartCard'

const COLORS = ['#1A0087', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export function ProductosTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>({})

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [top, cats, abc, sinRot, sobre, agot, serv, valor] = await Promise.all([
                    productosMasVendidos(sb, filtros),
                    categoriasMasVendidas(sb, filtros),
                    clasificacionABC(sb, filtros),
                    productosSinRotacion(sb, filtros),
                    sobrestock(sb, filtros),
                    agotadosConDemanda(sb, filtros),
                    nivelServicio(sb, filtros),
                    valorInventario(sb, filtros),
                ])
                setData({ top, cats, abc, sinRot, sobre, agot, serv, valor })
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando productos…</p>

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Nivel de servicio" value={`${(data.serv?.pct || 0).toFixed(1)}%`} color="green"
                    sub={`${data.serv?.aprobado ?? 0} / ${data.serv?.solicitado ?? 0} unid.`} />
                <KpiCard label="Valor inventario" value={fmtMoney(data.valor?.valor || 0)} color="purple"
                    sub={`${data.valor?.unidades ?? 0} unidades`} />
                <KpiCard label="Sin rotación 90d" value={data.sinRot?.length ?? 0} color="yellow" />
                <KpiCard label="Agotados con demanda" value={data.agot?.length ?? 0} color="red" />
            </div>

            <ChartCard title="Top 15 productos más vendidos" empty={data.top?.length === 0}>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.top} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="nombre" type="category" width={160} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#1A0087" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Categorías más vendidas (unidades)" empty={data.cats?.length === 0}>
                <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                        <Pie data={data.cats} dataKey="cantidad" nameKey="categoria" outerRadius={100} label={(e: any) => `${e.categoria} ${e.pct.toFixed(0)}%`}>
                            {data.cats?.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`Clasificación ABC — A: ${data.abc?.resumen?.A ?? 0} · B: ${data.abc?.resumen?.B ?? 0} · C: ${data.abc?.resumen?.C ?? 0}`} empty={data.abc?.clasificados?.length === 0}>
                <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b">
                            <tr><th className="text-left py-2">Producto</th><th className="text-right">Ingreso</th><th className="text-right">% Acum.</th><th className="text-center">Clase</th></tr>
                        </thead>
                        <tbody>
                            {data.abc?.clasificados?.slice(0, 30).map((p: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="py-1.5">{p.nombre}</td>
                                    <td className="text-right">{fmtMoney(p.ingreso)}</td>
                                    <td className="text-right">{p.pctAcum.toFixed(1)}%</td>
                                    <td className="text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.clase === 'A' ? 'bg-green-100 text-green-700' : p.clase === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{p.clase}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Productos sin rotación (90 días)" empty={data.sinRot?.length === 0}>
                    <div className="max-h-60 overflow-auto space-y-1">
                        {data.sinRot?.map((p: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                                <span className="text-gray-700">{p.nombre}</span>
                                <span className="text-gray-500">{p.stock} unid. · {p.categoria}</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                <ChartCard title="Sobrestock (>10× mínimo)" empty={data.sobre?.length === 0}>
                    <div className="max-h-60 overflow-auto space-y-1">
                        {data.sobre?.map((p: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                                <span className="text-gray-700">{p.nombre}</span>
                                <span className="text-orange-600">{p.stock} (min {p.minimo})</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            </div>

            <ChartCard title="Agotados con demanda (últimas 4 semanas)" empty={data.agot?.length === 0}>
                <div className="max-h-60 overflow-auto space-y-1">
                    {data.agot?.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                            <span className="text-gray-700">{p.nombre}</span>
                            <span className="text-red-600">{p.cantidad} unid. demandadas</span>
                        </div>
                    ))}
                </div>
            </ChartCard>
        </div>
    )
}