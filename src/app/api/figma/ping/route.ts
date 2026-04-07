import { NextRequest, NextResponse } from 'next/server'

interface PingBody {
  token: string
}

interface FigmaUserResponse {
  handle?: string
  email?: string
}

export async function POST(req: NextRequest) {
  const body = await req.json() as PingBody
  const { token } = body

  if (!token) {
    return NextResponse.json({ ok: false, error: 'Token is required' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'X-Figma-Token': token,
      },
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Figma API error: ${res.status}` })
    }

    const data = await res.json() as FigmaUserResponse
    return NextResponse.json({ ok: true, name: data.handle ?? data.email ?? 'Unknown' })
  } catch {
    return NextResponse.json({ ok: false, error: 'Network error' }, { status: 500 })
  }
}
