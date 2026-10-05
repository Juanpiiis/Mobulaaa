// app/api/auth/google/route.ts
import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google/oauth'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
        }

        const { data: perfil } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', user.id)
            .single()

        if (perfil?.rol !== 'admin') {
            return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
        }

        const authUrl = getAuthUrl()
        return NextResponse.redirect(authUrl)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}