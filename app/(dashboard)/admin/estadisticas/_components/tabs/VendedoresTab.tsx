'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FiltrosStats } from '../queries/types'
import { rankingVendedores, ticketPromedioVendedor, rechazosPorVendedor, descuentoPromedioVendedor } from '../queries/vendedores'
import { ChartCard } from '../ChartCard'

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0)

export function VendedoresTab({ filtros }: { filtros: FiltrosStats }) {
    const sb = createClient()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>({})

    useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const [rank, tickets, rech, desc] = await Promise.all([
                    rankingVendedores(sb, filtros),
                    ticketPromedioVendedor(sb, filtros),
                    rechazosPorVendedor(sb, filtros),
                    descuentoPromedioVendedor(sb, filtros),
                ])
                setData({ rank, tickets, rech, desc })
            } catch (err) { console.error(err) }
            setLoading(false)
        })()
    }, [JSON.stringify(filtros)])

    if (loading) return <p className="text-sm text-gray-500 py-6">Cargando vendedores…</p>

    const Tabla = ({ titulo, rows, cols }: any) => (
        <ChartCard title={titulo} empty={!rows || rows.length === 0}>
            <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 border-b sticky top-0 bg-white">
                        <tr>{cols.map((c: any, i: number) => <th key={i} className={c.align || 'text-left'}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows?.map((r: any, i: number) => (
                            <tr key={i} className="border-b border-gray-50">
                                {cols.map((c: any, j: number) => <td key={j} className={`py-1.5 ${c.align || 'text-left'}`}>{c.render(r)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ChartCard>
    )

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Tabla titulo="🏆 Ranking" rows={data.rank} cols={[
                { label: '#', render: (_: any) => '' },
                { label: 'Vendedor', render: (r: any) => r.nombre },
                { label: 'Pedidos', align: 'text-right', render: (r: any) => r.pedidos },
                { label: 'Total', align: 'text-right', render: (r: any) => fmtMoney(r.total) },
            ]} />
            <Tabla titulo="💵 Ticket promedio" rows={data.tickets} cols={[
                { label: 'Vendedor', render: (r: any) => r.nombre },
                { label: 'Ticket', align: 'text-right', render: (r: any) => fmtMoney(r.ticket) },
            ]} />
            <Tabla titulo="↩️ Rechazos / devoluciones" rows={data.rech} cols={[
                { label: 'Vendedor', render: (r: any) => r.nombre },
                { label: 'Total', align: 'text-right', render: (r: any) => r.total },
                { label: 'Rech.', align: 'text-right', render: (r: any) => r.rechazados },
                { label: 'Dev.', align: 'text-right', render: (r: any) => r.devueltos },
                { label: '%', align: 'text-right', render: (r: any) => `${r.pct.toFixed(1)}%` },
            ]} />
            <Tabla titulo="🏷️ Descuento promedio" rows={data.desc} cols={[
                { label: 'Vendedor', render: (r: any) => r.nombre },
                { label: 'Descuento prom.', align: 'text-right', render: (r: any) => `${r.promedio.toFixed(1)}%` },
            ]} />
        </div>
    )
}