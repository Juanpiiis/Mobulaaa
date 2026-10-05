'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TiendaProvider } from '@/lib/context/TiendaContext'

export function ProvidersWithKey({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => {
        // 1. Cargar usuario inicial
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id || null)
        })

        // 2. Escuchar cambios de sesión (login / logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    // 🔑 El key hace que TiendaProvider se desmonte y remonte
    // cuando cambia el usuario → reinicia los timers de inactividad
    return (
        <TiendaProvider key={userId || 'no-user'}>
            {children}
        </TiendaProvider>
    )
}