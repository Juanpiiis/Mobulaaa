// app/api/admin/crear-usuario/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: { autoRefreshToken: false, persistSession: false },
    }
)

export async function POST(req: NextRequest) {
    try {
        // 1. Verificar admin
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

        const { data: perfil } = await supabase
            .from('usuarios').select('rol').eq('id', user.id).single()
        if (perfil?.rol !== 'admin') {
            return NextResponse.json({ error: 'Solo admins' }, { status: 403 })
        }

        // 2. Leer body (con bodegas_ids array)
        const { email, nombre, password, rol, bodegas_ids } = await req.json()

        if (!email || !nombre || !password || !rol) {
            return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
        }

        if (password.length < 8) {
            return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 })
        }

        const rolesValidos = ['admin', 'bodeguero', 'vendedor', 'cartera']
        if (!rolesValidos.includes(rol)) {
            return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
        }

        // 3. Crear en auth
        const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError || !newUser.user) {
            return NextResponse.json(
                { error: authError?.message || 'Error creando usuario' },
                { status: 500 }
            )
        }

        // 4. Insertar en usuarios (bodega_id = primera si hay varias, o null)
        const bodegaPrimera = Array.isArray(bodegas_ids) && bodegas_ids.length > 0
            ? bodegas_ids[0]
            : null

        const { error: dbError } = await supabaseAdmin
            .from('usuarios')
            .insert({
                id: newUser.user.id,
                nombre,
                email,
                rol,
                bodega_id: bodegaPrimera,  // compatibilidad
                activo: true,
                requiere_cambio_password: true,
            })

        if (dbError) {
            await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
            return NextResponse.json({ error: dbError.message }, { status: 500 })
        }

        // 5. Insertar en usuario_bodegas (todas las asignadas)
        if (Array.isArray(bodegas_ids) && bodegas_ids.length > 0) {
            const { error: errAsig } = await supabaseAdmin
                .from('usuario_bodegas')
                .insert(
                    bodegas_ids.map((bodega_id: string) => ({
                        usuario_id: newUser.user.id,
                        bodega_id,
                    }))
                )

            if (errAsig) {
                console.error('Error asignando bodegas:', errAsig)
                // No hacer rollback por esto, solo loguear
            }
        }

        return NextResponse.json({
            ok: true,
            user: { id: newUser.user.id, email, nombre, rol },
        })
    } catch (err: any) {
        console.error('Error general:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}