'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts'
import { FiltrosStats } from '../queries/types'
import { ventasPorMes, comparacionPeriodos, ventasPorBodega, descuentosOtorgados, entregadosVsCancelados, fmtMoney, fmtPct } from '../queries/ventas'
import { KpiCard } from '../KpiCard'
import { ChartCard } from '../ChartCard'

export function VentasTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [mes, setMes] = useState<any[]>([])
    const [comp, setComp] = useState<any>(null)
    const [bod, setBod] = useState<any[]>([])
    const [desc, setDesc] = useState<any>(null)
    const [estados, setEstados] = useState<any>(null)

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [m, c, b, d, e] = await Promise.all([
                    ventasPorMes(sb, filtros),
                    comparacionPeriodos(sb, filtros),
                    ventasPorBodega(sb, filtros),
                    descuentosOtorgados(sb, filtros),
                    entregadosVsCancelados(sb, filtros),
                ])
                setMes(m); setComp(c); setBod(b); setDesc(d); setEstados(e)
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando ventas…</p>

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Ventas periodo" value={fmtMoney(comp?.actual || 0)} color="green" />
                <KpiCard label="Periodo anterior" value={fmtMoney(comp?.anterior || 0)} color="blue" />
                <KpiCard
                    label="Variación"
                    value={`${(comp?.variacion || 0) >= 0 ? '+' : ''}${fmtPct(comp?.variacion || 0)}`}
                    color={(comp?.variacion || 0) >= 0 ? 'green' : 'red'}
                />
                <KpiCard label="Descuentos" value={fmtMoney(desc?.descuento || 0)} sub={fmtPct(desc?.pct || 0)} color="yellow" />
            </div>

            <ChartCard title="Ventas por mes" empty={mes.length === 0}>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={mes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                        <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                        <Bar dataKey="total" fill="#1A0087" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Ventas por bodega" empty={bod.length === 0}>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={bod} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                        <YAxis dataKey="bodega" type="category" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Entregados vs cancelados" empty={!estados}>
                <div className="grid grid-cols-3 gap-3">
                    <KpiCard label="Entregados" value={estados?.entregados ?? 0} color="green" />
                    <KpiCard label="Cancelados/Rechazados" value={estados?.cancelados ?? 0} color="red" />
                    <KpiCard label="Total pedidos" value={estados?.total ?? 0} color="blue" />
                </div>
            </ChartCard>
        </div>
    )
}