// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, saveTokens } from '@/lib/google/oauth'

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
        return NextResponse.redirect(
            new URL('/admin/configuracion?google_error=' + error, req.url)
        )
    }

    if (!code) {
        return NextResponse.redirect(
            new URL('/admin/configuracion?google_error=no_code', req.url)
        )
    }

    try {
        const { refreshToken, email } = await exchangeCode(code)
        await saveTokens(refreshToken, email)

        return NextResponse.redirect(
            new URL('/admin/configuracion?google_connected=true', req.url)
        )
    } catch (error: any) {
        console.error('Error OAuth callback:', error)
        return NextResponse.redirect(
            new URL(
                '/admin/configuracion?google_error=' + encodeURIComponent(error.message),
                req.url
            )
        )
    }
}