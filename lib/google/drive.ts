// lib/google/drive.ts
import { google } from 'googleapis'
import { Readable } from 'stream'
import { getStoredAuth } from './oauth'

async function getDriveClient() {
    const auth = await getStoredAuth()

    if (!auth) {
        throw new Error(
            'Google Drive no está conectado. Ve a /admin/configuracion y autoriza el acceso.'
        )
    }

    return google.drive({ version: 'v3', auth })
}

/**
 * Busca o crea una subcarpeta dentro de una carpeta específica
 * @param nombreSubcarpeta Nombre de la carpeta a crear/buscar
 * @param parentId ID de la carpeta padre (opcional, si no se pasa usa GOOGLE_DRIVE_FOLDER_ID)
 */
export async function buscarOCrearSubcarpetaEn(
    nombreSubcarpeta: string,
    parentId?: string
): Promise<string> {
    const drive = await getDriveClient()
    const parent = parentId || process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!parent) {
        throw new Error('Falta GOOGLE_DRIVE_FOLDER_ID en .env.local')
    }

    // 1. Buscar si ya existe
    const busqueda = await drive.files.list({
        q: `'${parent}' in parents and name = '${nombreSubcarpeta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    })

    if (busqueda.data.files && busqueda.data.files.length > 0) {
        return busqueda.data.files[0].id!
    }

    // 2. Crear
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

/**
 * Alias para compatibilidad hacia atrás
 */
export async function buscarOCrearSubcarpeta(
    nombreSubcarpeta: string
): Promise<string> {
    return buscarOCrearSubcarpetaEn(nombreSubcarpeta)
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

    // Hacer público para ver sin login
    await drive.permissions.create({
        fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
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