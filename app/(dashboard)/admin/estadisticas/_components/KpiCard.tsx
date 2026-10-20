import { ReactNode } from 'react'

export function KpiCard({
    label, value, sub, color = 'blue', icon,
}: { label: string; value: ReactNode; sub?: string; color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'; icon?: ReactNode }) {
    const map = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-green-50 text-green-700',
        yellow: 'bg-yellow-50 text-yellow-700',
        red: 'bg-red-50 text-red-700',
        purple: 'bg-purple-50 text-purple-700',
    }
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
            {icon && <div className={`p-2.5 rounded-lg ${map[color]}`}>{icon}</div>}
            <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-800">{value}</p>
                {sub && <p className="text-xs text-gray-400">{sub}</p>}
            </div>
        </div>
    )
}