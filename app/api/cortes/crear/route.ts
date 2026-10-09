import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
    parsearExcel,
    compararConUltimoCorte,
    crearCorte,
    type DiferenciaItem,
} from '@/lib/utils/cortes'

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        console.log('🔍 Cookies:', cookieStore.getAll().map(c => c.name))

        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        console.log('🔍 User:', user?.id || 'NULL', 'Error:', authError?.message)

        if (!user) {
            return NextResponse.json(
                { error: 'No autenticado. Cerrá sesión y volvé a iniciar.' },
                { status: 401 }
            )
        }

        const { data: perfil, error: perfilError } = await supabase
            .from('usuarios')
            .select('rol, nombre')
            .eq('id', user.id)
            .single()

        if (!perfil || perfil.rol !== 'admin') {
            return NextResponse.json(
                { error: `Solo admin. Tu rol: ${perfil?.rol || 'ninguno'}` },
                { status: 403 }
            )
        }

        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const bodegaId = formData.get('bodega_id') as string | null
        const notas = formData.get('notas') as string | null

        if (!file) return NextResponse.json({ error: 'Falta el archivo Excel' }, { status: 400 })
        if (!bodegaId) return NextResponse.json({ error: 'Falta la bodega' }, { status: 400 })
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            return NextResponse.json({ error: 'El archivo debe ser .xlsx o .xls' }, { status: 400 })
        }

        let filas
        try {
            filas = await parsearExcel(file)
            console.log('🔍 Filas parseadas:', filas.length)
        } catch (parseError: any) {
            return NextResponse.json(
                { error: 'Error parseando el Excel: ' + parseError.message },
                { status: 400 }
            )
        }

        let diferencias: DiferenciaItem[]
        try {
            diferencias = await compararConUltimoCorte(supabase, filas, bodegaId)
            console.log('🔍 Diferencias:', diferencias.length)
        } catch (compError: any) {
            return NextResponse.json(
                { error: 'Error comparando: ' + compError.message },
                { status: 500 }
            )
        }

        // ⬇️ pasamos supabase como primer argumento
        const res = await crearCorte(supabase, {
            archivoNombre: file.name,
            bodegaId,
            diferencias,
            notas: notas || undefined,
        })

        if (!res.ok) {
            return NextResponse.json({ error: res.error }, { status: 500 })
        }

        const resumen = {
            total: diferencias.length,
            nuevos: diferencias.filter(d => d.tipo_cambio === 'nuevo').length,
            modificados: diferencias.filter(d => d.tipo_cambio === 'modificado').length,
            ausentes: diferencias.filter(d => d.tipo_cambio === 'ausente').length,
            sin_cambios: diferencias.filter(d => d.tipo_cambio === 'sin_cambio').length,
        }

        return NextResponse.json({
            ok: true,
            corteId: res.corteId,
            resumen,
        })
    } catch (error: any) {
        console.error('❌ Error en /api/cortes/crear:', error.message)
        return NextResponse.json(
            { error: error.message || 'Error inesperado' },
            { status: 500 }
        )
    }
}