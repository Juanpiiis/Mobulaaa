'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TiendaProvider } from '@/lib/context/TiendaContext'
import { ThemeProvider } from '@/lib/context/ThemeContext'

export function ProvidersWithKey({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id || null)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    return (
        <ThemeProvider>
            <TiendaProvider key={userId || 'no-user'}>
                {children}
            </TiendaProvider>
        </ThemeProvider>
    )
}