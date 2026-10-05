'use client'

import {
    DocumentTextIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline'
import type { EstadoCotizacion } from '@/lib/utils/cotizacion'

interface Props {
    estado: EstadoCotizacion
    numeroCotizacion?: string | null
    size?: 'sm' | 'md' | 'lg'
}

const CONFIG = {
    borrador: {
        label: 'Borrador',
        icon: DocumentTextIcon,
        className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    },
    pendiente: {
        label: 'Pendiente cartera',
        icon: ClockIcon,
        className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    oficial: {
        label: 'Oficial',
        icon: CheckCircleIcon,
        className: 'bg-green-50 text-green-700 border-green-200',
    },
    rechazado: {
        label: 'Rechazado',
        icon: XCircleIcon,
        className: 'bg-red-50 text-red-700 border-red-200',
    },
}

export function CotizacionBadge({ estado, numeroCotizacion, size = 'md' }: Props) {
    const config = CONFIG[estado]
    const Icon = config.icon

    const sizeClass = {
        sm: 'text-[10px] px-2 py-0.5 gap-1',
        md: 'text-xs px-2.5 py-1 gap-1.5',
        lg: 'text-sm px-3 py-1.5 gap-2',
    }[size]

    const iconClass = {
        sm: 'w-3 h-3',
        md: 'w-3.5 h-3.5',
        lg: 'w-4 h-4',
    }[size]

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <span
                className={`inline-flex items-center rounded-lg font-semibold border ${config.className} ${sizeClass}`}
            >
                <Icon className={iconClass} />
                {config.label}
            </span>
            {numeroCotizacion && (
                <span className="text-xs font-mono text-[#828282]">
                    {numeroCotizacion}
                </span>
            )}
        </div>
    )
}