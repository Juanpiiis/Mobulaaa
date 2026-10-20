'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { FiltrosStats } from '../queries/types'
import { movimientosPorTipo, rotacionInventario, stockBajoAgotados, actividadPorUsuario, productosConDiferencias, ajustesPorMotivo } from '../queries/bodega'
import { ChartCard } from '../ChartCard'
import { KpiCard } from '../KpiCard'

export function BodegaTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>({})

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [movs, rot, stock, act, dif, ajustes] = await Promise.all([
                    movimientosPorTipo(sb, filtros),
                    rotacionInventario(sb, filtros),
                    stockBajoAgotados(sb, filtros),
                    actividadPorUsuario(sb, filtros),
                    productosConDiferencias(sb, filtros),
                    ajustesPorMotivo(sb, filtros),
                ])
                setData({ movs, rot, stock, act, dif, ajustes })
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando bodega…</p>

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Rotación inventario" value={`${(data.rot?.rotacion || 0).toFixed(2)}×`} color="purple" sub={`${data.rot?.salidas ?? 0} salidas`} />
                <KpiCard label="Stock bajo" value={data.stock?.bajo ?? 0} color="yellow" />
                <KpiCard label="Agotados" value={data.stock?.agotados ?? 0} color="red" />
                <KpiCard label="Ajustes registrados" value={data.ajustes?.reduce((s: number, a: any) => s + a.count, 0) ?? 0} color="blue" />
            </div>

            <ChartCard title="Movimientos por tipo" empty={data.movs?.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.movs}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#1A0087" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Actividad por usuario" empty={data.act?.length === 0}>
                    <div className="max-h-60 overflow-auto space-y-1">
                        {data.act?.map((a: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                                <span className="text-gray-700">{a.nombre}</span>
                                <span className="text-blue-600 font-medium">{a.count} mov.</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                <ChartCard title="Ajustes por motivo" empty={data.ajustes?.length === 0}>
                    <div className="max-h-60 overflow-auto space-y-1">
                        {data.ajustes?.map((a: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm border-b border-gray-50 py-1">
                                <span className="text-gray-700">{a.motivo}</span>
                                <span className={a.delta < 0 ? 'text-red-600' : 'text-green-600'}>{a.delta > 0 ? '+' : ''}{a.delta}</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            </div>

            <ChartCard title="Productos con más diferencias en cortes" empty={data.dif?.length === 0}>
                <div className="max-h-60 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                            <tr><th className="text-left">Referencia</th><th className="text-right">Cortes con dif.</th><th className="text-right">Dif. total abs.</th></tr>
                        </thead>
                        <tbody>
                            {data.dif?.map((d: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="py-1.5">{d.ref}</td>
                                    <td className="text-right">{d.count}</td>
                                    <td className="text-right text-red-600">{d.difTotal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ChartCard>
        </div>
    )
}