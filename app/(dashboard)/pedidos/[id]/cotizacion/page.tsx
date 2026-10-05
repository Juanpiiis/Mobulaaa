'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { CotizacionPreview } from '@/components/cotizaciones/CotizacionPreview'

export default function CotizacionPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const router = useRouter()

    return (
        <div className="min-h-screen bg-gray-50">
            <CotizacionPreview pedidoId={id} onClose={() => router.back()} />
        </div>
    )
}