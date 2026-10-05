// lib/google/oauth.ts
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
]

export function getOAuth2Client() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        throw new Error('Faltan GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET')
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        `${siteUrl}/api/auth/google/callback`
    )
}

export function getAuthUrl(): string {
    const oauth2Client = getOAuth2Client()

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    })
}

export async function exchangeCode(code: string): Promise<{
    refreshToken: string
    email: string
}> {
    const oauth2Client = getOAuth2Client()

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
        throw new Error('No se recibió refresh_token. Vuelve a autorizar.')
    }

    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data } = await oauth2.userinfo.get()

    return {
        refreshToken: tokens.refresh_token,
        email: data.email || '',
    }
}

export async function saveTokens(refreshToken: string, email: string): Promise<void> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { error } = await supabase
        .from('google_oauth_tokens')
        .upsert(
            {
                user_id: user.id,
                refresh_token: refreshToken,
                email,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        )

    if (error) throw error
}

export async function getStoredAuth() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('google_oauth_tokens')
        .select('refresh_token')
        .eq('user_id', user.id)
        .maybeSingle()

    if (error || !data?.refresh_token) return null

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: data.refresh_token })

    return oauth2Client
}