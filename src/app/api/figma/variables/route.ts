import { NextRequest, NextResponse } from 'next/server'

interface VariablesBody {
  token: string
  fileKey: string
}

// Raw Figma variable value — color, number, string, boolean, or alias
type RawValue =
  | { r: number; g: number; b: number; a: number }
  | number
  | string
  | boolean
  | { type: 'VARIABLE_ALIAS'; id: string }

interface FigmaVariable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, RawValue>
  hiddenFromPublishing?: boolean
}

interface FigmaVariableCollection {
  id: string
  name: string
  defaultModeId: string
  modes: Array<{ modeId: string; name: string }>
  hiddenFromPublishing?: boolean
}

// Compact token shapes returned to the client
export interface ColorToken {
  id: string
  name: string
  collection: string
  hex: string               // '#rrggbb'
  r: number; g: number; b: number; a: number
}

export interface NumberToken {
  id: string
  name: string
  collection: string
  value: number
  role: 'radius' | 'spacing' | 'size' | 'opacity' | 'other'
}

export interface VariablesResult {
  colors: ColorToken[]
  numbers: NumberToken[]
  totalCount: number
  collectionNames: string[]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function inferNumberRole(name: string): NumberToken['role'] {
  const n = name.toLowerCase()
  if (/radius|corner|rounded/.test(n)) return 'radius'
  if (/spacing|space|gap|padding|margin|indent/.test(n)) return 'spacing'
  if (/size|width|height|icon/.test(n)) return 'size'
  if (/opacity|alpha/.test(n)) return 'opacity'
  return 'other'
}

// Resolve variable aliases one level deep
function resolveValue(
  raw: RawValue,
  allVars: Record<string, FigmaVariable>,
  defaultModes: Map<string, string>,
): RawValue | null {
  if (raw && typeof raw === 'object' && 'type' in raw && raw.type === 'VARIABLE_ALIAS') {
    const ref = allVars[raw.id]
    if (!ref) return null
    const modeId = defaultModes.get(ref.variableCollectionId)
    if (!modeId) return null
    const refVal = ref.valuesByMode[modeId]
    if (!refVal || (typeof refVal === 'object' && 'type' in refVal)) return null
    return refVal
  }
  return raw
}

export async function POST(req: NextRequest) {
  const body = await req.json() as VariablesBody
  const { token, fileKey } = body

  if (!token || !fileKey) {
    return NextResponse.json({ error: 'token and fileKey are required' }, { status: 400 })
  }

  type VarAPIResponse = {
    meta?: {
      variables?: Record<string, FigmaVariable>
      variableCollections?: Record<string, FigmaVariableCollection>
    }
  }

  const tryEndpoint = async (endpoint: string) => {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/${endpoint}`, {
      headers: { 'X-Figma-Token': token },
    })
    return { res, endpoint }
  }

  try {
    // Prefer local (has valuesByMode), fall back to published
    let res: Response | null = null
    for (const ep of ['variables/local', 'variables/published']) {
      const result = await tryEndpoint(ep)
      if (result.res.ok) { res = result.res; break }
    }

    if (!res) {
      return NextResponse.json(
        { error: 'Figma Variables API에 접근할 수 없습니다. Variables API는 Figma Professional 이상의 플랜에서 사용 가능합니다.' },
        { status: 403 },
      )
    }

    const data = await res.json() as VarAPIResponse

    const allVars = data.meta?.variables ?? {}
    const allCollections = data.meta?.variableCollections ?? {}

    // Build default mode map
    const defaultModes = new Map<string, string>()
    const collectionNameMap = new Map<string, string>()
    for (const [id, col] of Object.entries(allCollections)) {
      if (!col.hiddenFromPublishing) {
        defaultModes.set(id, col.defaultModeId)
        collectionNameMap.set(id, col.name)
      }
    }

    const colors: ColorToken[] = []
    const numbers: NumberToken[] = []

    for (const v of Object.values(allVars)) {
      if (v.hiddenFromPublishing) continue

      const modeId = defaultModes.get(v.variableCollectionId)
      if (!modeId) continue

      const raw = v.valuesByMode[modeId]
      if (raw === undefined || raw === null) continue

      const resolved = resolveValue(raw, allVars, defaultModes)
      if (!resolved) continue

      const collectionName = collectionNameMap.get(v.variableCollectionId) ?? 'Unknown'

      if (v.resolvedType === 'COLOR' && typeof resolved === 'object' && 'r' in resolved) {
        const { r, g, b, a } = resolved as { r: number; g: number; b: number; a: number }
        colors.push({
          id: v.id,
          name: v.name,
          collection: collectionName,
          hex: rgbToHex(r, g, b),
          r, g, b, a,
        })
      }

      if (v.resolvedType === 'FLOAT' && typeof resolved === 'number') {
        numbers.push({
          id: v.id,
          name: v.name,
          collection: collectionName,
          value: resolved,
          role: inferNumberRole(v.name),
        })
      }
    }

    // Sort for readability
    colors.sort((a, b) => a.name.localeCompare(b.name))
    numbers.sort((a, b) => a.name.localeCompare(b.name))

    const result: VariablesResult = {
      colors,
      numbers,
      totalCount: colors.length + numbers.length,
      collectionNames: [...new Set([...colors, ...numbers].map((t) => t.collection))].sort(),
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 500 })
  }
}
