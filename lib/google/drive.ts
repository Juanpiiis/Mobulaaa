// lib/google/drive.ts
import { google } from 'googleapis'
import { Readable } from 'stream'
import { getStoredAuth } from './oauth'
import { createClient } from '@/lib/supabase/server'

async function getDriveClient() {
    const auth = await getStoredAuth()

    if (!auth) {
        throw new Error(
            'Google Drive no está conectado. Ve a /admin/configuracion y autoriza el acceso.'
        )
    }

    return google.drive({ version: 'v3', auth })
}

export async function buscarOCrearSubcarpetaEn(
    nombreSubcarpeta: string,
    parentId?: string
): Promise<string> {
    const drive = await getDriveClient()
    const parent = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!parent) {
        throw new Error('Falta GOOGLE_DRIVE_FOLDER_ID en .env.local')
    }

    const busqueda = await drive.files.list({
        q: `'${parent}' in parents and name = '${nombreSubcarpeta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    })

    if (busqueda.data.files && busqueda.data.files.length > 0) {
        return busqueda.data.files[0].id!
    }

    const nuevaCarpeta = await drive.files.create({
        requestBody: {
            name: nombreSubcarpeta,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parent],
        },
        fields: 'id',
    })

    return nuevaCarpeta.data.id!
}

export async function buscarOCrearSubcarpeta(
    nombreSubcarpeta: string
): Promise<string> {
    return buscarOCrearSubcarpetaEn(nombreSubcarpeta)
}

// ============================================================
// 🆕 Organización automática por Año / Mes (hora Colombia)
// ============================================================

const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Devuelve { año: '2025', mes: 'Octubre' } en zona horaria America/Bogota.
 */
export function obtenerAñoYMes(fecha: Date = new Date()): {
    año: string
    mes: string
} {
    const partes = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: 'numeric',
    }).formatToParts(fecha)

    const año = partes.find(p => p.type === 'year')!.value
    const mesNumero = parseInt(partes.find(p => p.type === 'month')!.value, 10)

    return {
        año,
        mes: MESES_ES[mesNumero - 1],
    }
}

/**
 * Asegura la jerarquía Año/Mes en Drive y devuelve el ID de la carpeta del mes.
 * Cachea el folder_id en google_oauth_tokens.drive_folders (JSONB):
 *   { "2025-Octubre": "1XyZ...", "2025-Noviembre": "1AbC..." }
 */
export async function obtenerCarpetaAñoMes(
    fecha: Date = new Date()
): Promise<string> {
    const { año, mes } = obtenerAñoYMes(fecha)
    const clave = `${año}-${mes}` // ej: "2025-Octubre"

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // 1️⃣ Leer caché
    const { data: tokenRow } = await supabase
        .from('google_oauth_tokens')
        .select('drive_folders')
        .eq('user_id', user.id)
        .maybeSingle()

    const cache: Record<string, string> = tokenRow?.drive_folders || {}

    if (cache[clave]) {
        return cache[clave]
    }

    // 2️⃣ No está en caché: crear/obtener en Drive
    const carpetaAñoId = await buscarOCrearSubcarpetaEn(año)
    const carpetaMesId = await buscarOCrearSubcarpetaEn(mes, carpetaAñoId)

    // 3️⃣ Guardar en caché (no bloquea si falla)
    await supabase
        .from('google_oauth_tokens')
        .update({
            drive_folders: { ...cache, [clave]: carpetaMesId },
        })
        .eq('user_id', user.id)

    return carpetaMesId
}

/**
 * Sube un PDF a Drive
 */
export async function subirPDFaDrive(
    nombreArchivo: string,
    pdfBuffer: Buffer,
    parentFolderId: string
): Promise<{ fileId: string; url: string }> {
    const drive = await getDriveClient()
    const stream = Readable.from(pdfBuffer)

    const response = await drive.files.create({
        requestBody: {
            name: nombreArchivo,
            mimeType: 'application/pdf',
            parents: [parentFolderId],
        },
        media: {
            mimeType: 'application/pdf',
            body: stream,
        },
        fields: 'id, webViewLink',
    })

    const fileId = response.data.id!

    await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
    })

    const fileInfo = await drive.files.get({
        fileId,
        fields: 'id, webViewLink',
    })

    return {
        fileId,
        url:
            fileInfo.data.webViewLink ||
            `https://drive.google.com/file/d/${fileId}/view`,
    }
}