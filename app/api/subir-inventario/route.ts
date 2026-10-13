// app/api/subir-inventario/route.ts
// RUTA DESHABILITADA.
// El flujo correcto de carga de inventario es:
//   POST /api/cortes/crear   (crea un corte para comparar antes de aplicar)
//
// Esta ruta hacía upsert directo sobre productos e inventario, sin corte,
// sin trazabilidad y sin verificar sesión ni rol. Ya no se usa.
// Se deja el archivo para no romper referencias, pero devuelve 410 Gone.

import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: 'Ruta deshabilitada. Usa el flujo de cortes: /admin/subir-inventario (pantalla) → /api/cortes/crear.',
    },
    { status: 410 }
  )
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Ruta deshabilitada.' },
    { status: 410 }
  )
}