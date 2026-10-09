import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revertirCorte } from '@/lib/utils/cortes'

export async function POST(req: NextRequest) {
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

        if (!perfil || perfil.rol !== 'admin') {
            return NextResponse.json(
                { error: 'Solo el administrador puede revertir cortes' },
                { status: 403 }
            )
        }

        const body = await req.json()
        const { corteId, motivo } = body

        if (!corteId) {
            return NextResponse.json({ error: 'Falta corteId' }, { status: 400 })
        }
        if (!motivo || motivo.trim().length < 10) {
            return NextResponse.json(
                { error: 'El motivo debe tener al menos 10 caracteres' },
                { status: 400 }
            )
        }

        // ⬇️ pasamos supabase como primer argumento
        const res = await revertirCorte(supabase, corteId, motivo)

        if (!res.ok) {
            return NextResponse.json({ error: res.error }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error: any) {
        console.error('Error en /api/cortes/revertir:', error)
        return NextResponse.json(
            { error: error.message || 'Error inesperado' },
            { status: 500 }
        )
    }
}