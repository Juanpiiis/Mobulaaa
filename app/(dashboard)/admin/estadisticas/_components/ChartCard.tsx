import { ReactNode } from 'react'

export function ChartCard({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">{title}</h3>
            {empty ? <p className="text-gray-400 text-sm py-6 text-center">Sin datos para el periodo</p> : children}
        </div>
    )
}