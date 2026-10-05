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

export async function buscarOCrearSubcarpeta(
    nombreSubcarpeta: string
): Promise<string> {
    const drive = await getDriveClient()
    const parentId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!parentId) {
        throw new Error('Falta GOOGLE_DRIVE_FOLDER_ID en .env.local')
    }

    const busqueda = await drive.files.list({
        q: `'${parentId}' in parents and name = '${nombreSubcarpeta}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
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
            parents: [parentId],
        },
        fields: 'id',
    })

    return nuevaCarpeta.data.id!
}

export async function subirPDFaDrive(
    nombreArchivo: string,
    pdfBuffer: Buffer,
    parentFolderId?: string
): Promise<{ fileId: string; url: string }> {
    const drive = await getDriveClient()
    const parentId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!parentId) {
        throw new Error('Falta GOOGLE_DRIVE_FOLDER_ID en .env.local')
    }

    const stream = Readable.from(pdfBuffer)

    const response = await drive.files.create({
        requestBody: {
            name: nombreArchivo,
            mimeType: 'application/pdf',
            parents: [parentId],
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