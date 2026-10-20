// lib/google/drive.ts
import { google } from 'googleapis'
import { Readable } from 'stream'
import { getStoredAuth } from './oauth'
import { createClient } from '@/lib/supabase/server'

const CARPETA_RAIZ = 'Cotizaciones'

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
// Organización automática por Año / Mes / Día (hora Colombia)
// ============================================================

const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Devuelve { año, mes, dia } en zona horaria America/Bogota.
 * El mes viene sin número (ej. 'Octubre') y el día como '19 Octubre'.
 */
export function obtenerAñoMesDia(fecha: Date = new Date()): {
    año: string
    mes: string
    dia: string
} {
    const partes = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(fecha)

    const año = partes.find(p => p.type === 'year')!.value
    const mesNumero = parseInt(partes.find(p => p.type === 'month')!.value, 10)
    const diaNumero = partes.find(p => p.type === 'day')!.value.padStart(2, '0')

    const nombreMes = MESES_ES[mesNumero - 1]

    return {
        año,
        mes: nombreMes,
        dia: `${diaNumero} ${nombreMes}`
    }
}

/**
 * Asegura la jerarquía RAIZ / BODEGA / AÑO / MES / DÍA en Drive y devuelve el ID de la carpeta final.
 */
export async function obtenerCarpetaAñoMes(
    bodegaNombre: string,
    fecha: Date = new Date()
): Promise<string> {
    const { año, mes, dia } = obtenerAñoMesDia(fecha)
    const clave = `${bodegaNombre}-${año}-${mes}-${dia}`

    const supabase = await createClient()

    // 1️⃣ Leer caché
    const { data: tokenRow } = await supabase
        .from('google_oauth_tokens')
        .select('drive_folders')
        .eq('config_key', 'global')
        .maybeSingle()

    const cache: Record<string, string> = tokenRow?.drive_folders || {}

    if (cache[clave]) {
        return cache[clave]
    }

    // 2️⃣ No está en caché: crear la ruta completa
    // Nivel 1: Cotizaciones
    const carpetaRaizId = await buscarOCrearSubcarpetaEn(CARPETA_RAIZ)
    // Nivel 2: Bodega
    const carpetaBodegaId = await buscarOCrearSubcarpetaEn(bodegaNombre, carpetaRaizId)
    // Nivel 3: Año
    const carpetaAñoId = await buscarOCrearSubcarpetaEn(año, carpetaBodegaId)
    // Nivel 4: Mes
    const carpetaMesId = await buscarOCrearSubcarpetaEn(mes, carpetaAñoId)
    // Nivel 5: Día (Ej: "19 Octubre")
    const carpetaDiaId = await buscarOCrearSubcarpetaEn(dia, carpetaMesId)

    // 3️⃣ Guardar en caché
    await supabase
        .from('google_oauth_tokens')
        .update({
            drive_folders: { ...cache, [clave]: carpetaDiaId },
        })
        .eq('config_key', 'global')

    return carpetaDiaId
}

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
        url: fileInfo.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    }
}