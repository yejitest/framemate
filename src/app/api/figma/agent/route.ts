import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

interface AgentBody {
  prompt: string
  mode: 'component' | 'screen'
  token?: string
  fileKey?: string
}

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function extractFileKey(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed.includes('/')) return trimmed
  const match = trimmed.match(/figma\.com\/(?:design|file|proto)\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

interface FigmaPage {
  id: string
  name: string
  type: string
}

interface FigmaFileData {
  name: string
  document: { children: FigmaPage[] }
}

async function readFigmaFile(token: string, key: string): Promise<FigmaFileData | null> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${key}?depth=1`, {
      headers: { 'X-Figma-Token': token },
    })
    if (!res.ok) return null
    return res.json() as Promise<FigmaFileData>
  } catch {
    return null
  }
}

async function postFigmaComment(token: string, key: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${key}/comments`, {
      method: 'POST',
      headers: { 'X-Figma-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Design System — Figma Variables (primary token source)
// ─────────────────────────────────────────────────────────────────────────────

type RawVarValue =
  | { r: number; g: number; b: number; a: number }
  | number
  | string
  | boolean
  | { type: 'VARIABLE_ALIAS'; id: string }

interface FigmaVar {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, RawVarValue>
  hiddenFromPublishing?: boolean
}

interface FigmaVarCollection {
  id: string
  name: string
  defaultModeId: string
  modes: Array<{ modeId: string; name: string }>
  hiddenFromPublishing?: boolean
}

async function getDSVariables(
  token: string,
  fileKey: string,
): Promise<{ vars: FigmaVar[]; collections: FigmaVarCollection[] }> {
  type VarResponse = {
    meta?: {
      variables?: Record<string, FigmaVar>
      variableCollections?: Record<string, FigmaVarCollection>
    }
  }

  const tryFetch = async (endpoint: string) => {
    try {
      const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/${endpoint}`, {
        headers: { 'X-Figma-Token': token },
      })
      if (!res.ok) return null
      const data = await res.json() as VarResponse
      const vars = Object.values(data.meta?.variables ?? {})
      const collections = Object.values(data.meta?.variableCollections ?? {})
      // Only accept if we have variables with actual valuesByMode data
      const hasValues = vars.some((v) => v.valuesByMode && Object.keys(v.valuesByMode).length > 0)
      return hasValues ? { vars, collections } : null
    } catch {
      return null
    }
  }

  // Try local first (has actual values), fall back to published
  return (await tryFetch('variables/local'))
    ?? (await tryFetch('variables/published'))
    ?? { vars: [], collections: [] }
}

function resolveVarValue(
  raw: RawVarValue,
  allVars: Map<string, FigmaVar>,
  defaultModes: Map<string, string>,
): Exclude<RawVarValue, { type: 'VARIABLE_ALIAS'; id: string }> | null {
  if (raw && typeof raw === 'object' && 'type' in raw && raw.type === 'VARIABLE_ALIAS') {
    const ref = allVars.get(raw.id)
    if (!ref) return null
    const modeId = defaultModes.get(ref.variableCollectionId)
    if (!modeId) return null
    const refVal = ref.valuesByMode[modeId]
    if (!refVal || (typeof refVal === 'object' && 'type' in refVal && refVal.type === 'VARIABLE_ALIAS')) return null
    return refVal as Exclude<RawVarValue, { type: 'VARIABLE_ALIAS'; id: string }>
  }
  return raw as Exclude<RawVarValue, { type: 'VARIABLE_ALIAS'; id: string }>
}

// Merge DSTokens with values extracted from Figma Variables
function applyVariablesToTokens(
  vars: FigmaVar[],
  collections: FigmaVarCollection[],
  tokens: DSTokens,
): DSTokens {
  const result = { ...tokens }
  const toFC = (c: { r: number; g: number; b: number }) =>
    `{r:${c.r.toFixed(3)},g:${c.g.toFixed(3)},b:${c.b.toFixed(3)}}`

  const defaultModes = new Map<string, string>()
  for (const col of collections) {
    if (!col.hiddenFromPublishing) defaultModes.set(col.id, col.defaultModeId)
  }
  const varMap = new Map(vars.map((v) => [v.id, v]))

  for (const v of vars) {
    if (v.hiddenFromPublishing) continue
    const modeId = defaultModes.get(v.variableCollectionId)
    if (!modeId) continue
    const raw = v.valuesByMode[modeId]
    if (raw === undefined || raw === null) continue
    const resolved = resolveVarValue(raw, varMap, defaultModes)
    if (resolved === null) continue

    const n = v.name.toLowerCase()

    if (v.resolvedType === 'COLOR' && typeof resolved === 'object' && 'r' in resolved) {
      const fc = toFC(resolved as { r: number; g: number; b: number })
      if (!result.primary && matchesRole(n, ['primary', 'brand', 'accent', 'main', 'interactive', 'action', 'cta', 'key'])) {
        result.primary = fc; result.appliedRoles.push(`primary: ${v.name}`)
      }
      if (!result.bg && (matchesRole(n, ['background', 'canvas', 'page', 'base']) || /^(bg|background)$/.test(n) || n.endsWith('/bg') || n.endsWith('/background') || n.startsWith('bg/'))) {
        result.bg = fc; result.appliedRoles.push(`bg: ${v.name}`)
      }
      if (!result.surface && matchesRole(n, ['surface', 'card', 'elevated', 'panel', 'container', 'layer', 'overlay'])) {
        result.surface = fc; result.appliedRoles.push(`surface: ${v.name}`)
      }
      if (!result.text && (matchesRole(n, ['text/primary', 'text-primary', 'foreground', 'on-background', 'content/primary', 'label/primary']) || /^(text|fg|foreground)$/.test(n))) {
        result.text = fc; result.appliedRoles.push(`text: ${v.name}`)
      }
      if (!result.muted && matchesRole(n, ['text/secondary', 'muted', 'subtle', 'disabled', 'placeholder', 'hint', 'tertiary', 'dim', 'secondary text', 'label/secondary'])) {
        result.muted = fc; result.appliedRoles.push(`muted: ${v.name}`)
      }
      if (!result.border && matchesRole(n, ['border', 'stroke', 'divider', 'separator', 'outline', 'line', 'rule', 'hairline'])) {
        result.border = fc; result.appliedRoles.push(`border: ${v.name}`)
      }
      if (!result.success && matchesRole(n, ['success', 'positive', 'confirmed', 'done', 'green', 'correct'])) {
        result.success = fc; result.appliedRoles.push(`success: ${v.name}`)
      }
      if (!result.danger && matchesRole(n, ['error', 'danger', 'destructive', 'negative', 'red', 'critical'])) {
        result.danger = fc; result.appliedRoles.push(`danger: ${v.name}`)
      }
    }

    if (v.resolvedType === 'FLOAT' && typeof resolved === 'number' && resolved > 0) {
      if (!result.fontFamily && matchesRole(n, ['font-size', 'fontsize', 'font/size'])) {
        // skip — not for font family
      }
      // Radius tokens
      if (matchesRole(n, ['radius', 'corner', 'rounded'])) {
        if (matchesRole(n, ['sm', 'small', 'xs', '2', '4'])) result.radiusSm = Math.round(resolved)
        else if (matchesRole(n, ['lg', 'large', 'xl', '3', 'full']) && resolved < 500) result.radiusLg = Math.round(resolved)
        else if (resolved < 100) result.radiusMd = Math.round(resolved)
      }
      // Spacing tokens
      if (matchesRole(n, ['spacing', 'space', 'gap', 'padding', 'margin'])) {
        if (matchesRole(n, ['sm', 'small', 'xs', '1', '2'])) result.spacingSm = Math.round(resolved)
        else if (matchesRole(n, ['lg', 'large', 'xl', '4', '5', '6'])) result.spacingLg = Math.round(resolved)
        else result.spacingMd = Math.round(resolved)
      }
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Design System — style & component token extraction (fallback)
// ─────────────────────────────────────────────────────────────────────────────

interface DSComponent {
  key: string
  name: string
  description: string
  node_id: string
}

interface DSStyle {
  key: string
  name: string
  style_type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
  node_id: string
}

interface StyleValue {
  name: string
  style_type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
  color?: { r: number; g: number; b: number }
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  // fontStyle as returned by Figma REST API (e.g. "Semibold", "Semi Bold", "Medium")
  fontStyleName?: string
  // DROP_SHADOW effect
  shadow?: {
    r: number; g: number; b: number; a: number
    offsetX: number; offsetY: number; radius: number
  }
}

// Semantic token set extracted from the DS file
interface DSTokens {
  // Colors (Figma plugin color object strings e.g. "{r:0.2,g:0.4,b:0.9}")
  primary?: string
  bg?: string
  surface?: string
  text?: string
  muted?: string
  border?: string
  success?: string
  danger?: string
  // Typography
  fontFamily?: string
  // fontStyles maps fontWeight → confirmed style name for the DS font family
  fontStyles: Record<number, string>
  // Spacing & shape (extracted from component nodes)
  radiusSm: number   // default 8
  radiusMd: number   // default 12
  radiusLg: number   // default 16
  radiusFull: number // default 9999
  spacingSm: number  // default 8
  spacingMd: number  // default 16
  spacingLg: number  // default 24
  // Shadow (Figma Plugin API effects array entry, serialised as JS literal string)
  shadowMd?: string
  // Human-readable log of what was extracted
  appliedRoles: string[]
}

// fontWeight number → candidate style name list (first match wins when probing)
const WEIGHT_STYLES: Record<number, string[]> = {
  100: ['Thin', 'Hairline'],
  200: ['ExtraLight', 'Extra Light', 'UltraLight', 'Ultra Light'],
  300: ['Light'],
  400: ['Regular'],
  500: ['Medium'],
  600: ['SemiBold', 'Semibold', 'Semi Bold', 'DemiBold', 'Demi Bold'],
  700: ['Bold'],
  800: ['ExtraBold', 'Extra Bold', 'Heavy', 'UltraBold'],
  900: ['Black', 'Heavy', 'Ultra Black'],
}

// Default hardcoded values used in generators — must stay in sync with gen* functions
const HARDCODED = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusFull: 9999,  // badges use 100 which is close enough; we handle separately
  spacingSm: 8,
  spacingMd: 16,
  spacingLg: 24,
  paddingMd: 20,      // card/modal inner padding
  itemSpacingSm: 6,   // input label gap
  itemSpacingMd: 10,  // card inner gap
  paddingInlineMd: 12, // input left/right padding
  paddingInlineLg: 16, // button left/right padding
}

async function getDSComponents(token: string, fileKey: string): Promise<DSComponent[]> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/components`, {
      headers: { 'X-Figma-Token': token },
    })
    if (!res.ok) return []
    const data = await res.json() as { meta?: { components?: DSComponent[] } }
    return data.meta?.components ?? []
  } catch {
    return []
  }
}

async function getDSStyles(token: string, fileKey: string): Promise<DSStyle[]> {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/styles`, {
      headers: { 'X-Figma-Token': token },
    })
    if (!res.ok) return []
    const data = await res.json() as { meta?: { styles?: DSStyle[] } }
    return data.meta?.styles ?? []
  } catch {
    return []
  }
}

// Fetch actual color/font/effect values by reading style definition nodes
async function getDSStyleValues(
  token: string,
  fileKey: string,
  styles: DSStyle[],
): Promise<StyleValue[]> {
  const relevant = styles
    .filter((s) => s.style_type === 'FILL' || s.style_type === 'TEXT' || s.style_type === 'EFFECT')
    .slice(0, 80)
  if (relevant.length === 0) return []

  const ids = relevant.map((s) => s.node_id).join(',')
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${ids}`, {
      headers: { 'X-Figma-Token': token },
    })
    if (!res.ok) return []

    type FigmaEffect = {
      type: string
      visible?: boolean
      color?: { r: number; g: number; b: number; a: number }
      offset?: { x: number; y: number }
      radius?: number
    }
    type NodeDoc = {
      fills?: Array<{ type: string; color?: { r: number; g: number; b: number; a: number } }>
      style?: {
        fontFamily?: string
        fontSize?: number
        fontWeight?: number
        italic?: boolean
      }
      effects?: FigmaEffect[]
    }
    const data = await res.json() as { nodes: Record<string, { document: NodeDoc } | null> }

    return relevant
      .map((style): StyleValue | null => {
        const doc = data.nodes[style.node_id]?.document
        if (!doc) return null
        const sv: StyleValue = { name: style.name, style_type: style.style_type }

        if (style.style_type === 'FILL') {
          const solid = doc.fills?.find((f) => f.type === 'SOLID' && f.color)
          if (solid?.color) sv.color = solid.color
        }

        if (style.style_type === 'TEXT' && doc.style) {
          sv.fontFamily = doc.style.fontFamily
          sv.fontSize = doc.style.fontSize
          sv.fontWeight = doc.style.fontWeight
          // Derive Figma-style name from weight for accurate loadFontAsync calls
          if (doc.style.fontWeight) {
            const candidates = WEIGHT_STYLES[doc.style.fontWeight]
            sv.fontStyleName = candidates?.[0]
          }
        }

        if (style.style_type === 'EFFECT') {
          const drop = doc.effects?.find(
            (e) => e.type === 'DROP_SHADOW' && e.visible !== false && e.color,
          )
          if (drop?.color) {
            sv.shadow = {
              r: drop.color.r,
              g: drop.color.g,
              b: drop.color.b,
              a: drop.color.a ?? 0.15,
              offsetX: drop.offset?.x ?? 0,
              offsetY: drop.offset?.y ?? 4,
              radius: drop.radius ?? 8,
            }
          }
        }

        return sv
      })
      .filter((sv): sv is StyleValue => sv !== null && (!!sv.color || !!sv.fontFamily || !!sv.shadow))
  } catch {
    return []
  }
}

// Fetch component node properties to extract radius and spacing tokens
async function getDSComponentTokens(
  token: string,
  fileKey: string,
  components: DSComponent[],
): Promise<{ radiusMd: number; spacingMd: number; spacingLg: number }> {
  const sample = components.slice(0, 30)
  if (sample.length === 0) return { radiusMd: HARDCODED.radiusMd, spacingMd: HARDCODED.spacingMd, spacingLg: HARDCODED.spacingLg }

  const ids = sample.map((c) => c.node_id).join(',')
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${ids}`, {
      headers: { 'X-Figma-Token': token },
    })
    if (!res.ok) return { radiusMd: HARDCODED.radiusMd, spacingMd: HARDCODED.spacingMd, spacingLg: HARDCODED.spacingLg }

    type CompDoc = {
      cornerRadius?: number
      paddingLeft?: number
      paddingTop?: number
      itemSpacing?: number
    }
    const data = await res.json() as { nodes: Record<string, { document: CompDoc } | null> }

    const radii: number[] = []
    const paddings: number[] = []
    const gaps: number[] = []

    for (const node of Object.values(data.nodes)) {
      const doc = node?.document
      if (!doc) continue
      if (typeof doc.cornerRadius === 'number' && doc.cornerRadius > 0 && doc.cornerRadius < 100) {
        radii.push(doc.cornerRadius)
      }
      if (typeof doc.paddingLeft === 'number' && doc.paddingLeft > 0) {
        paddings.push(doc.paddingLeft)
      }
      if (typeof doc.paddingTop === 'number' && doc.paddingTop > 0) {
        paddings.push(doc.paddingTop)
      }
      if (typeof doc.itemSpacing === 'number' && doc.itemSpacing > 0) {
        gaps.push(doc.itemSpacing)
      }
    }

    const mode = (arr: number[], fallback: number) => {
      if (arr.length === 0) return fallback
      const freq = new Map<number, number>()
      for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1)
      return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }

    const radiusMd = mode(radii, HARDCODED.radiusMd)
    const spacingMd = mode(paddings, HARDCODED.spacingMd)
    // spacingLg: use the most common large padding (>=16)
    const largePaddings = paddings.filter((p) => p >= 16)
    const spacingLg = mode(largePaddings, HARDCODED.spacingLg)

    return { radiusMd, spacingMd, spacingLg }
  } catch {
    return { radiusMd: HARDCODED.radiusMd, spacingMd: HARDCODED.spacingMd, spacingLg: HARDCODED.spacingLg }
  }
}

function matchesRole(name: string, roles: string[]): boolean {
  return roles.some((r) => name.includes(r))
}

// Build full DSTokens from style values + component geometry
function extractTokens(
  styleValues: StyleValue[],
  compTokens: { radiusMd: number; spacingMd: number; spacingLg: number },
): DSTokens {
  const tokens: DSTokens = {
    fontStyles: {},
    radiusSm: Math.max(Math.round(compTokens.radiusMd * 0.6), 4),
    radiusMd: compTokens.radiusMd,
    radiusLg: Math.round(compTokens.radiusMd * 1.4),
    radiusFull: HARDCODED.radiusFull,
    spacingSm: Math.max(Math.round(compTokens.spacingMd * 0.5), 4),
    spacingMd: compTokens.spacingMd,
    spacingLg: compTokens.spacingLg,
    appliedRoles: [],
  }

  const toFC = (c: { r: number; g: number; b: number }) =>
    `{r:${c.r.toFixed(3)},g:${c.g.toFixed(3)},b:${c.b.toFixed(3)}}`

  // Font family — prefer non-mono
  const textStyles = styleValues.filter((sv) => sv.fontFamily)
  if (textStyles.length > 0) {
    tokens.fontFamily =
      textStyles.find((sv) => !/mono|code|courier|consolas|fira|cascadia/i.test(sv.fontFamily!))?.fontFamily
      ?? textStyles[0].fontFamily
    tokens.appliedRoles.push(`폰트: ${tokens.fontFamily}`)

    // Build weight→styleName map from all TEXT styles with the same family
    for (const sv of textStyles) {
      if (sv.fontFamily === tokens.fontFamily && sv.fontWeight && sv.fontStyleName) {
        tokens.fontStyles[sv.fontWeight] = sv.fontStyleName
      }
    }
  }

  // Shadow from EFFECT styles (use the first medium-weight drop shadow)
  const effectStyles = styleValues.filter((sv) => sv.shadow)
  if (effectStyles.length > 0) {
    const sh = effectStyles[0].shadow!
    tokens.shadowMd = `{type:'DROP_SHADOW',color:{r:${sh.r.toFixed(3)},g:${sh.g.toFixed(3)},b:${sh.b.toFixed(3)},a:${sh.a.toFixed(3)}},offset:{x:${sh.offsetX},y:${sh.offsetY}},radius:${sh.radius},spread:0,visible:true,blendMode:'NORMAL'}`
    tokens.appliedRoles.push(`shadow: ${effectStyles[0].name}`)
  }

  for (const sv of styleValues) {
    if (!sv.color) continue
    const n = sv.name.toLowerCase()
    const fc = toFC(sv.color)

    if (!tokens.primary && matchesRole(n, ['primary', 'brand', 'accent', 'main', 'key', 'interactive', 'action', 'cta'])) {
      tokens.primary = fc; tokens.appliedRoles.push(`primary: ${sv.name}`)
    }
    if (!tokens.bg && (matchesRole(n, ['background', 'canvas', 'page', 'base']) || n === 'bg' || n.endsWith('/bg') || n.startsWith('bg/'))) {
      tokens.bg = fc; tokens.appliedRoles.push(`bg: ${sv.name}`)
    }
    if (!tokens.surface && matchesRole(n, ['surface', 'card', 'elevated', 'panel', 'container', 'layer', 'overlay', 'secondary bg'])) {
      tokens.surface = fc; tokens.appliedRoles.push(`surface: ${sv.name}`)
    }
    if (!tokens.text && (matchesRole(n, ['text/primary', 'text-primary', 'foreground', 'on-background', 'content/primary', 'label/primary']) || n === 'text' || n === 'fg' || n === 'foreground')) {
      tokens.text = fc; tokens.appliedRoles.push(`text: ${sv.name}`)
    }
    if (!tokens.muted && matchesRole(n, ['text/secondary', 'muted', 'subtle', 'disabled', 'placeholder', 'hint', 'tertiary', 'dim', 'secondary text', 'label/secondary'])) {
      tokens.muted = fc; tokens.appliedRoles.push(`muted: ${sv.name}`)
    }
    if (!tokens.border && matchesRole(n, ['border', 'stroke', 'divider', 'separator', 'outline', 'line', 'rule', 'hairline'])) {
      tokens.border = fc; tokens.appliedRoles.push(`border: ${sv.name}`)
    }
    if (!tokens.success && matchesRole(n, ['success', 'positive', 'confirmed', 'done', 'green', 'correct'])) {
      tokens.success = fc; tokens.appliedRoles.push(`success: ${sv.name}`)
    }
    if (!tokens.danger && matchesRole(n, ['error', 'danger', 'destructive', 'negative', 'red', 'critical', 'warning/error', 'alert/error'])) {
      tokens.danger = fc; tokens.appliedRoles.push(`danger: ${sv.name}`)
    }
  }

  // Append radius/spacing summary if they differ from defaults
  if (tokens.radiusMd !== HARDCODED.radiusMd) {
    tokens.appliedRoles.push(`radius: ${tokens.radiusSm}/${tokens.radiusMd}/${tokens.radiusLg}`)
  }
  if (tokens.spacingMd !== HARDCODED.spacingMd) {
    tokens.appliedRoles.push(`spacing: ${tokens.spacingSm}/${tokens.spacingMd}/${tokens.spacingLg}`)
  }

  return tokens
}

// Post-process generated plugin code: replace all hardcoded defaults with DS token values
function applyTokens(code: string, tokens: DSTokens): string {
  let result = code

  // ── Colors ──
  const colorSubs: [string, string | undefined][] = [
    [PC.primary, tokens.primary],
    [PC.surface, tokens.surface],
    [PC.border, tokens.border],
    [PC.text, tokens.text],
    [PC.muted, tokens.muted],
    [PC.bg, tokens.bg],
    [PC.success, tokens.success],
    [PC.danger, tokens.danger],
  ]
  for (const [from, to] of colorSubs) {
    if (to) result = result.split(from).join(to)
  }

  // ── Border radius ──
  // Use exact integer replacements so "cornerRadius = 12" doesn't also hit "cornerRadius = 120"
  result = result.replace(/cornerRadius = 8\b/g, `cornerRadius = ${tokens.radiusSm}`)
  result = result.replace(/cornerRadius = 12\b/g, `cornerRadius = ${tokens.radiusMd}`)
  result = result.replace(/cornerRadius = 16\b/g, `cornerRadius = ${tokens.radiusLg}`)
  // badge full-radius (100) stays as-is unless radiusFull was customised
  if (tokens.radiusFull !== HARDCODED.radiusFull) {
    result = result.replace(/cornerRadius = 100\b/g, `cornerRadius = ${tokens.radiusFull}`)
  }

  // ── Spacing ──
  // Card/modal inner padding (20)
  result = result.replace(/paddingLeft = 20; f\.paddingRight = 20/g,
    `paddingLeft = ${tokens.spacingLg}; f.paddingRight = ${tokens.spacingLg}`)
  result = result.replace(/paddingLeft = 20; card\.paddingRight = 20/g,
    `paddingLeft = ${tokens.spacingLg}; card.paddingRight = ${tokens.spacingLg}`)
  result = result.replace(/paddingTop = 20; [a-z]+\.paddingBottom = 20/g,
    (m) => m.replace(/20/g, String(tokens.spacingLg)))
  // Button left/right padding (16)
  result = result.replace(/paddingLeft = 16; f\.paddingRight = 16/g,
    `paddingLeft = ${tokens.spacingMd}; f.paddingRight = ${tokens.spacingMd}`)
  // Input left/right padding (12)
  result = result.replace(/paddingLeft = 12; [a-z]+\.paddingRight = 12/g,
    (m) => m.replace(/12/g, String(tokens.spacingSm)))
  // Badge left/right padding (10) — keep proportional
  result = result.replace(/paddingLeft = 10; badge\.paddingRight = 10/g,
    `paddingLeft = ${tokens.spacingSm}; badge.paddingRight = ${tokens.spacingSm}`)
  // itemSpacing (10 card inner, 6 input label gap)
  result = result.replace(/itemSpacing = 10\b/g, `itemSpacing = ${tokens.spacingSm}`)
  result = result.replace(/itemSpacing = 6\b/g,  `itemSpacing = ${Math.max(Math.round(tokens.spacingSm * 0.75), 4)}`)

  // ── Shadow ──
  if (tokens.shadowMd) {
    // Inject shadow onto card/modal frames that currently have no shadow
    result = result.replace(
      /card\.strokes = \[\{type:'SOLID',color:[^}]+\}\];/g,
      `card.strokes = [{type:'SOLID',color:${tokens.border ?? PC.border}}]; card.effects = [${tokens.shadowMd}];`,
    )
    result = result.replace(
      /modal\.strokes = \[\{type:'SOLID',color:[^}]+\}\];/g,
      `modal.strokes = [{type:'SOLID',color:${tokens.border ?? PC.border}}]; modal.effects = [${tokens.shadowMd}];`,
    )
  }

  // ── Font family + style names ──
  if (tokens.fontFamily && tokens.fontFamily !== 'Inter') {
    const dsFamily = JSON.stringify(tokens.fontFamily)

    // Build the font-loading helper block that's injected into the async IIFE.
    // It probes each weight-style pair from the DS so we know the exact style names,
    // storing results in _fs (font styles map) and _fm (family to use).
    const stylesNeeded = [
      { weight: 400, fallbacks: WEIGHT_STYLES[400] },
      { weight: 500, fallbacks: WEIGHT_STYLES[500] },
      { weight: 600, fallbacks: WEIGHT_STYLES[600] },
      { weight: 700, fallbacks: WEIGHT_STYLES[700] },
    ]

    // Compose a runtime font probe that resolves correct style names per weight
    const probeLines = stylesNeeded.map(({ weight, fallbacks }) => {
      // Use the DS-extracted style name as first candidate if available
      const dsStyle = tokens.fontStyles[weight]
      const candidates = dsStyle
        ? [dsStyle, ...fallbacks.filter((s) => s !== dsStyle)]
        : fallbacks
      const candidatesLiteral = JSON.stringify(candidates)
      return `  _fs[${weight}] = await (async () => { for (const s of ${candidatesLiteral}) { try { await figma.loadFontAsync({family:_fm,style:s}); return s; } catch(e) {} } return null; })();`
    })

    const fontHelper = [
      ``,
      `  // DS font resolution — probes style names at runtime for this font family`,
      `  let _fm = 'Inter'; // will be replaced with DS family if available`,
      `  const _fs = {}; // weight → confirmed style name`,
      `  try { await figma.loadFontAsync({family:${dsFamily},style:'Regular'}); _fm = ${dsFamily}; } catch(e) {}`,
      `  if (_fm !== 'Inter') {`,
      ...probeLines.map((l) => '  ' + l),
      `  }`,
      ``,
    ].join('\n')

    result = result.replace('(async () => {\n', `(async () => {\n${fontHelper}`)

    // Replace each hardcoded style:'X' for fontName and loadFontAsync with _fs[weight]??'X'
    const styleNameMap: Record<string, number> = {
      Regular: 400,
      Medium: 500,
      'Semi Bold': 600,
      SemiBold: 600,
      Bold: 700,
    }
    for (const [styleName, weight] of Object.entries(styleNameMap)) {
      // fontName: {family:'Inter',style:'Bold'} → {family:_fm,style:(_fs[700]??'Bold')}
      result = result.split(`family:'Inter',style:'${styleName}'`)
        .join(`family:_fm,style:(_fs[${weight}]??'${styleName}')`)
      // loadFontAsync({family:'Inter',style:'Bold'}) similarly handled by family replacement
      result = result.split(`family:'Inter'`)
        .join(`family:_fm`)
    }

    // Catch any remaining bare family:'Inter' references not matched above
    result = result.split(`family:'Inter'`).join(`family:_fm`)
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin code generators
// Produces self-contained async IIFE code runnable in Figma Plugin context
// ─────────────────────────────────────────────────────────────────────────────

const PC = {
  primary: '{r:0.655,g:0.545,b:0.98}',
  surface: '{r:0.102,g:0.102,b:0.102}',
  surfaceDim: '{r:0.055,g:0.055,b:0.055}',
  border: '{r:0.165,g:0.165,b:0.165}',
  text: '{r:0.973,g:0.973,b:0.973}',
  muted: '{r:0.533,g:0.533,b:0.533}',
  bg: '{r:0.039,g:0.039,b:0.039}',
  white: '{r:1,g:1,b:1}',
  success: '{r:0.29,g:0.867,b:0.502}',
  danger: '{r:0.973,g:0.443,b:0.443}',
}

function genButton(prompt: string): string {
  const lower = prompt.toLowerCase()
  const isSecondary = lower.includes('secondary') || lower.includes('세컨')
  const isGhost = lower.includes('ghost') || lower.includes('아웃라인') || lower.includes('outline')
  const label = lower.includes('취소') ? '취소' : lower.includes('확인') ? '확인' : lower.includes('저장') ? '저장' : lower.includes('삭제') ? '삭제' : 'Button'
  const variantName = isGhost ? 'Ghost' : isSecondary ? 'Secondary' : 'Primary'
  const bgColor = isGhost || isSecondary ? PC.surface : PC.primary
  const txtColor = isGhost || isSecondary ? PC.text : PC.white
  const hasBorder = isGhost || isSecondary

  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  const f = figma.createFrame();
  f.name = 'Button/${variantName}';
  f.resize(120, 40);
  f.fills = [{type:'SOLID',color:${bgColor}}];
  f.cornerRadius = 8;
  f.layoutMode = 'HORIZONTAL';
  f.primaryAxisAlignItems = 'CENTER';
  f.counterAxisAlignItems = 'CENTER';
  f.paddingLeft = 16; f.paddingRight = 16;
  ${hasBorder ? `f.strokes = [{type:'SOLID',color:${PC.border}}]; f.strokeWeight = 1;` : ''}
  const t = figma.createText();
  t.fontName = {family:'Inter',style:'Medium'};
  t.characters = '${label}';
  t.fontSize = 14;
  t.fills = [{type:'SOLID',color:${txtColor}}];
  f.appendChild(t);
  figma.currentPage.appendChild(f);
  figma.viewport.scrollAndZoomIntoView([f]);
  figma.closePlugin('✅ 버튼 생성 완료!');
})();`
}

function genCard(prompt: string): string {
  const lower = prompt.toLowerCase()
  const title = lower.includes('사용자') ? '사용자 카드' : lower.includes('상품') ? '상품 카드' : lower.includes('프로필') ? '프로필 카드' : '카드 제목'
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Semi Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  const card = figma.createFrame();
  card.name = 'Card';
  card.resize(320, 200);
  card.fills = [{type:'SOLID',color:${PC.surface}}];
  card.cornerRadius = 12;
  card.strokes = [{type:'SOLID',color:${PC.border}}];
  card.strokeWeight = 1;
  card.layoutMode = 'VERTICAL';
  card.paddingLeft = 20; card.paddingRight = 20;
  card.paddingTop = 20; card.paddingBottom = 20;
  card.itemSpacing = 10;

  const ttl = figma.createText();
  ttl.fontName = {family:'Inter',style:'Semi Bold'};
  ttl.characters = '${title}';
  ttl.fontSize = 16;
  ttl.fills = [{type:'SOLID',color:${PC.text}}];

  const desc = figma.createText();
  desc.fontName = {family:'Inter',style:'Regular'};
  desc.characters = '카드 설명 텍스트가 여기에 들어갑니다.';
  desc.fontSize = 13;
  desc.fills = [{type:'SOLID',color:${PC.muted}}];

  const divider = figma.createRectangle();
  divider.resize(280, 1);
  divider.fills = [{type:'SOLID',color:${PC.border}}];

  card.appendChild(ttl);
  card.appendChild(desc);
  card.appendChild(divider);

  figma.currentPage.appendChild(card);
  figma.viewport.scrollAndZoomIntoView([card]);
  figma.closePlugin('✅ 카드 생성 완료!');
})();`
}

function genInput(prompt: string): string {
  const lower = prompt.toLowerCase()
  const labelText = lower.includes('이메일') ? '이메일' : lower.includes('비밀번호') ? '비밀번호' : lower.includes('이름') ? '이름' : '입력 필드'
  const placeholder = lower.includes('이메일') ? 'example@email.com' : lower.includes('비밀번호') ? '••••••••' : '내용을 입력하세요'
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  const wrap = figma.createFrame();
  wrap.name = 'Input/${labelText}';
  wrap.fills = [];
  wrap.layoutMode = 'VERTICAL';
  wrap.itemSpacing = 6;
  wrap.resize(280, 60);

  const lbl = figma.createText();
  lbl.fontName = {family:'Inter',style:'Medium'};
  lbl.characters = '${labelText}';
  lbl.fontSize = 12;
  lbl.fills = [{type:'SOLID',color:${PC.text}}];

  const field = figma.createFrame();
  field.name = 'Field';
  field.resize(280, 40);
  field.fills = [{type:'SOLID',color:${PC.surfaceDim}}];
  field.cornerRadius = 8;
  field.strokes = [{type:'SOLID',color:${PC.border}}];
  field.strokeWeight = 1;
  field.layoutMode = 'HORIZONTAL';
  field.counterAxisAlignItems = 'CENTER';
  field.paddingLeft = 12; field.paddingRight = 12;

  const ph = figma.createText();
  ph.fontName = {family:'Inter',style:'Regular'};
  ph.characters = '${placeholder}';
  ph.fontSize = 13;
  ph.fills = [{type:'SOLID',color:${PC.muted}}];
  field.appendChild(ph);

  wrap.appendChild(lbl);
  wrap.appendChild(field);
  figma.currentPage.appendChild(wrap);
  figma.viewport.scrollAndZoomIntoView([wrap]);
  figma.closePlugin('✅ 인풋 생성 완료!');
})();`
}

function genModal(prompt: string): string {
  const lower = prompt.toLowerCase()
  const title = lower.includes('확인') ? '확인하시겠습니까?' : lower.includes('삭제') ? '삭제 확인' : lower.includes('알림') ? '알림' : '모달 제목'
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Semi Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  await figma.loadFontAsync({family:'Inter',style:'Medium'});

  const modal = figma.createFrame();
  modal.name = 'Modal';
  modal.resize(480, 240);
  modal.fills = [{type:'SOLID',color:${PC.surface}}];
  modal.cornerRadius = 16;
  modal.strokes = [{type:'SOLID',color:${PC.border}}];
  modal.strokeWeight = 1;
  modal.effects = [{type:'DROP_SHADOW',color:{r:0,g:0,b:0,a:0.5},offset:{x:0,y:24},radius:48,spread:0,visible:true,blendMode:'NORMAL'}];

  const ttl = figma.createText();
  ttl.fontName = {family:'Inter',style:'Semi Bold'};
  ttl.characters = '${title}';
  ttl.fontSize = 18;
  ttl.fills = [{type:'SOLID',color:${PC.text}}];
  ttl.x = 24; ttl.y = 24;

  const body = figma.createText();
  body.fontName = {family:'Inter',style:'Regular'};
  body.characters = '이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?';
  body.fontSize = 14;
  body.fills = [{type:'SOLID',color:${PC.muted}}];
  body.x = 24; body.y = 62;
  body.resize(432, 40);

  const cancelBtn = figma.createFrame();
  cancelBtn.name = 'Button/Ghost';
  cancelBtn.resize(88, 36);
  cancelBtn.fills = [];
  cancelBtn.cornerRadius = 8;
  cancelBtn.strokes = [{type:'SOLID',color:${PC.border}}];
  cancelBtn.strokeWeight = 1;
  cancelBtn.layoutMode = 'HORIZONTAL';
  cancelBtn.primaryAxisAlignItems = 'CENTER';
  cancelBtn.counterAxisAlignItems = 'CENTER';
  cancelBtn.x = 268; cancelBtn.y = 180;
  const ct = figma.createText();
  ct.fontName = {family:'Inter',style:'Medium'};
  ct.characters = '취소'; ct.fontSize = 14;
  ct.fills = [{type:'SOLID',color:${PC.muted}}];
  cancelBtn.appendChild(ct);

  const confirmBtn = figma.createFrame();
  confirmBtn.name = 'Button/Primary';
  confirmBtn.resize(88, 36);
  confirmBtn.fills = [{type:'SOLID',color:${PC.primary}}];
  confirmBtn.cornerRadius = 8;
  confirmBtn.layoutMode = 'HORIZONTAL';
  confirmBtn.primaryAxisAlignItems = 'CENTER';
  confirmBtn.counterAxisAlignItems = 'CENTER';
  confirmBtn.x = 368; confirmBtn.y = 180;
  const cnf = figma.createText();
  cnf.fontName = {family:'Inter',style:'Medium'};
  cnf.characters = '확인'; cnf.fontSize = 14;
  cnf.fills = [{type:'SOLID',color:${PC.white}}];
  confirmBtn.appendChild(cnf);

  modal.appendChild(ttl);
  modal.appendChild(body);
  modal.appendChild(cancelBtn);
  modal.appendChild(confirmBtn);
  figma.currentPage.appendChild(modal);
  figma.viewport.scrollAndZoomIntoView([modal]);
  figma.closePlugin('✅ 모달 생성 완료!');
})();`
}

function genBadge(prompt: string): string {
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  const variants = [
    {label:'Default', color:${PC.primary}},
    {label:'Success', color:${PC.success}},
    {label:'Danger', color:${PC.danger}},
    {label:'Muted', color:${PC.muted}},
  ];
  let x = 0;
  const nodes = [];
  for (const v of variants) {
    const badge = figma.createFrame();
    badge.name = 'Badge/' + v.label;
    badge.cornerRadius = 100;
    badge.layoutMode = 'HORIZONTAL';
    badge.primaryAxisAlignItems = 'CENTER';
    badge.counterAxisAlignItems = 'CENTER';
    badge.paddingLeft = 10; badge.paddingRight = 10;
    badge.paddingTop = 4; badge.paddingBottom = 4;
    badge.fills = [{type:'SOLID',color:v.color,opacity:0.15}];
    const t = figma.createText();
    t.fontName = {family:'Inter',style:'Medium'};
    t.characters = v.label;
    t.fontSize = 11;
    t.fills = [{type:'SOLID',color:v.color}];
    badge.appendChild(t);
    badge.x = x;
    figma.currentPage.appendChild(badge);
    x += badge.width + 8;
    nodes.push(badge);
  }
  figma.viewport.scrollAndZoomIntoView(nodes);
  figma.closePlugin('✅ 배지 생성 완료!');
})();`
}

function genNav(prompt: string): string {
  const lower = prompt.toLowerCase()
  const logoName = lower.includes('회사') ? 'COMPANY' : lower.includes('앱') ? 'APP' : 'LOGO'
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  const nav = figma.createFrame();
  nav.name = 'Navigation/Header';
  nav.resize(1440, 64);
  nav.fills = [{type:'SOLID',color:${PC.surface}}];
  nav.strokes = [{type:'SOLID',color:${PC.border}}];
  nav.strokeWeight = 1; nav.strokeAlign = 'OUTSIDE';

  const logo = figma.createText();
  logo.fontName = {family:'Inter',style:'Bold'};
  logo.characters = '${logoName}';
  logo.fontSize = 16;
  logo.fills = [{type:'SOLID',color:${PC.primary}}];
  logo.x = 24; logo.y = 24;

  const links = ['홈', '소개', '서비스', '연락처'];
  let lx = 560;
  for (const label of links) {
    const t = figma.createText();
    t.fontName = {family:'Inter',style:'Regular'};
    t.characters = label;
    t.fontSize = 14;
    t.fills = [{type:'SOLID',color:${PC.muted}}];
    t.x = lx; t.y = 24;
    nav.appendChild(t);
    lx += t.width + 40;
  }

  const btn = figma.createFrame();
  btn.name = 'CTA';
  btn.resize(88, 36);
  btn.fills = [{type:'SOLID',color:${PC.primary}}];
  btn.cornerRadius = 8;
  btn.layoutMode = 'HORIZONTAL';
  btn.primaryAxisAlignItems = 'CENTER';
  btn.counterAxisAlignItems = 'CENTER';
  btn.x = 1328; btn.y = 14;
  const bt = figma.createText();
  bt.fontName = {family:'Inter',style:'Medium'};
  bt.characters = '시작하기'; bt.fontSize = 13;
  bt.fills = [{type:'SOLID',color:${PC.white}}];
  btn.appendChild(bt);

  nav.appendChild(logo);
  nav.appendChild(btn);
  figma.currentPage.appendChild(nav);
  figma.viewport.scrollAndZoomIntoView([nav]);
  figma.closePlugin('✅ 네비게이션 생성 완료!');
})();`
}

function genGenericComponent(prompt: string): string {
  const safePrompt = prompt.replace(/'/g, "\\'").slice(0, 40)
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Semi Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  const f = figma.createFrame();
  f.name = 'Component';
  f.resize(320, 120);
  f.fills = [{type:'SOLID',color:${PC.surface}}];
  f.cornerRadius = 12;
  f.strokes = [{type:'SOLID',color:${PC.border}}];
  f.strokeWeight = 1;
  f.layoutMode = 'VERTICAL';
  f.paddingLeft = 20; f.paddingRight = 20;
  f.paddingTop = 20; f.paddingBottom = 20;
  f.itemSpacing = 8;

  const ttl = figma.createText();
  ttl.fontName = {family:'Inter',style:'Semi Bold'};
  ttl.characters = '컴포넌트';
  ttl.fontSize = 15;
  ttl.fills = [{type:'SOLID',color:${PC.text}}];

  const sub = figma.createText();
  sub.fontName = {family:'Inter',style:'Regular'};
  sub.characters = '${safePrompt}';
  sub.fontSize = 13;
  sub.fills = [{type:'SOLID',color:${PC.muted}}];

  f.appendChild(ttl);
  f.appendChild(sub);
  figma.currentPage.appendChild(f);
  figma.viewport.scrollAndZoomIntoView([f]);
  figma.closePlugin('✅ 컴포넌트 생성 완료!');
})();`
}

function genLogin(): string {
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Semi Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});

  const screen = figma.createFrame();
  screen.name = 'Screen/Login';
  screen.resize(1440, 900);
  screen.fills = [{type:'SOLID',color:${PC.bg}}];

  const card = figma.createFrame();
  card.name = 'Login Card';
  card.resize(400, 460);
  card.fills = [{type:'SOLID',color:${PC.surface}}];
  card.cornerRadius = 16;
  card.strokes = [{type:'SOLID',color:${PC.border}}];
  card.strokeWeight = 1;
  card.x = 520; card.y = 220;

  const logoTxt = figma.createText();
  logoTxt.fontName = {family:'Inter',style:'Bold'};
  logoTxt.characters = 'LOGO';
  logoTxt.fontSize = 18;
  logoTxt.fills = [{type:'SOLID',color:${PC.primary}}];
  logoTxt.x = 40; logoTxt.y = 40;

  const heading = figma.createText();
  heading.fontName = {family:'Inter',style:'Bold'};
  heading.characters = '로그인';
  heading.fontSize = 28;
  heading.fills = [{type:'SOLID',color:${PC.text}}];
  heading.x = 40; heading.y = 80;

  const sub = figma.createText();
  sub.fontName = {family:'Inter',style:'Regular'};
  sub.characters = '계정에 로그인하세요';
  sub.fontSize = 14;
  sub.fills = [{type:'SOLID',color:${PC.muted}}];
  sub.x = 40; sub.y = 118;

  function makeField(label, placeholder, yPos) {
    const lbl = figma.createText();
    lbl.fontName = {family:'Inter',style:'Medium'};
    lbl.characters = label; lbl.fontSize = 12;
    lbl.fills = [{type:'SOLID',color:${PC.text}}];
    lbl.x = 40; lbl.y = yPos;

    const field = figma.createFrame();
    field.resize(320, 40);
    field.fills = [{type:'SOLID',color:${PC.surfaceDim}}];
    field.cornerRadius = 8;
    field.strokes = [{type:'SOLID',color:${PC.border}}];
    field.strokeWeight = 1;
    field.layoutMode = 'HORIZONTAL';
    field.counterAxisAlignItems = 'CENTER';
    field.paddingLeft = 12;
    field.x = 40; field.y = yPos + 20;

    const ph = figma.createText();
    ph.fontName = {family:'Inter',style:'Regular'};
    ph.characters = placeholder; ph.fontSize = 13;
    ph.fills = [{type:'SOLID',color:${PC.muted}}];
    field.appendChild(ph);

    card.appendChild(lbl);
    card.appendChild(field);
  }

  makeField('이메일', 'example@email.com', 152);
  makeField('비밀번호', '••••••••', 224);

  const loginBtn = figma.createFrame();
  loginBtn.name = 'Button/Login';
  loginBtn.resize(320, 44);
  loginBtn.fills = [{type:'SOLID',color:${PC.primary}}];
  loginBtn.cornerRadius = 8;
  loginBtn.layoutMode = 'HORIZONTAL';
  loginBtn.primaryAxisAlignItems = 'CENTER';
  loginBtn.counterAxisAlignItems = 'CENTER';
  loginBtn.x = 40; loginBtn.y = 308;
  const bt = figma.createText();
  bt.fontName = {family:'Inter',style:'Semi Bold'};
  bt.characters = '로그인'; bt.fontSize = 14;
  bt.fills = [{type:'SOLID',color:${PC.white}}];
  loginBtn.appendChild(bt);

  const signupLink = figma.createText();
  signupLink.fontName = {family:'Inter',style:'Regular'};
  signupLink.characters = '계정이 없으신가요? 회원가입';
  signupLink.fontSize = 13;
  signupLink.fills = [{type:'SOLID',color:${PC.muted}}];
  signupLink.x = 120; signupLink.y = 368;

  card.appendChild(logoTxt);
  card.appendChild(heading);
  card.appendChild(sub);
  card.appendChild(loginBtn);
  card.appendChild(signupLink);
  screen.appendChild(card);

  figma.currentPage.appendChild(screen);
  figma.viewport.scrollAndZoomIntoView([screen]);
  figma.closePlugin('✅ 로그인 스크린 생성 완료!');
})();`
}

function genDashboard(): string {
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Semi Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});

  const screen = figma.createFrame();
  screen.name = 'Screen/Dashboard';
  screen.resize(1440, 900);
  screen.fills = [{type:'SOLID',color:${PC.bg}}];

  // Sidebar
  const sidebar = figma.createFrame();
  sidebar.name = 'Sidebar';
  sidebar.resize(240, 900);
  sidebar.fills = [{type:'SOLID',color:${PC.surface}}];
  sidebar.strokes = [{type:'SOLID',color:${PC.border}}];
  sidebar.strokeWeight = 1; sidebar.strokeAlign = 'OUTSIDE';
  sidebar.x = 0; sidebar.y = 0;

  const sLogo = figma.createText();
  sLogo.fontName = {family:'Inter',style:'Bold'};
  sLogo.characters = 'LOGO';
  sLogo.fontSize = 16;
  sLogo.fills = [{type:'SOLID',color:${PC.primary}}];
  sLogo.x = 20; sLogo.y = 24;
  sidebar.appendChild(sLogo);

  const navItems = ['대시보드', '분석', '프로젝트', '설정'];
  navItems.forEach((item, i) => {
    const ni = figma.createFrame();
    ni.name = 'NavItem/' + item;
    ni.resize(208, 36);
    ni.cornerRadius = 8;
    ni.fills = i === 0 ? [{type:'SOLID',color:${PC.primary},opacity:0.15}] : [];
    ni.x = 16; ni.y = 72 + i * 44;
    const t = figma.createText();
    t.fontName = {family:'Inter',style:i === 0 ? 'Medium' : 'Regular'};
    t.characters = item; t.fontSize = 14;
    t.fills = [{type:'SOLID',color:i === 0 ? ${PC.primary} : ${PC.muted}}];
    t.x = 12; t.y = 10;
    ni.appendChild(t);
    sidebar.appendChild(ni);
  });
  screen.appendChild(sidebar);

  // Top bar
  const topBar = figma.createFrame();
  topBar.name = 'TopBar';
  topBar.resize(1200, 64);
  topBar.fills = [{type:'SOLID',color:${PC.surface}}];
  topBar.strokes = [{type:'SOLID',color:${PC.border}}];
  topBar.strokeWeight = 1; topBar.strokeAlign = 'OUTSIDE';
  topBar.x = 240; topBar.y = 0;
  const pageTitle = figma.createText();
  pageTitle.fontName = {family:'Inter',style:'Bold'};
  pageTitle.characters = '대시보드';
  pageTitle.fontSize = 18;
  pageTitle.fills = [{type:'SOLID',color:${PC.text}}];
  pageTitle.x = 24; pageTitle.y = 20;
  topBar.appendChild(pageTitle);
  screen.appendChild(topBar);

  // Stat cards
  const stats = [
    {label:'총 사용자', value:'1,234'},
    {label:'활성 프로젝트', value:'42'},
    {label:'완료 작업', value:'156'},
    {label:'이번 달 수익', value:'₩8.9M'},
  ];
  stats.forEach((s, i) => {
    const card = figma.createFrame();
    card.name = 'StatCard/' + s.label;
    card.resize(268, 100);
    card.fills = [{type:'SOLID',color:${PC.surface}}];
    card.cornerRadius = 12;
    card.strokes = [{type:'SOLID',color:${PC.border}}];
    card.strokeWeight = 1;
    card.x = 264 + i * 284; card.y = 88;

    const val = figma.createText();
    val.fontName = {family:'Inter',style:'Bold'};
    val.characters = s.value; val.fontSize = 24;
    val.fills = [{type:'SOLID',color:${PC.text}}];
    val.x = 20; val.y = 20;

    const lbl = figma.createText();
    lbl.fontName = {family:'Inter',style:'Regular'};
    lbl.characters = s.label; lbl.fontSize = 12;
    lbl.fills = [{type:'SOLID',color:${PC.muted}}];
    lbl.x = 20; lbl.y = 58;

    card.appendChild(val);
    card.appendChild(lbl);
    screen.appendChild(card);
  });

  // Content area
  const content = figma.createFrame();
  content.name = 'ContentArea';
  content.resize(1160, 600);
  content.fills = [{type:'SOLID',color:${PC.surface}}];
  content.cornerRadius = 12;
  content.strokes = [{type:'SOLID',color:${PC.border}}];
  content.strokeWeight = 1;
  content.x = 264; content.y = 212;
  screen.appendChild(content);

  figma.currentPage.appendChild(screen);
  figma.viewport.scrollAndZoomIntoView([screen]);
  figma.closePlugin('✅ 대시보드 생성 완료!');
})();`
}

function genSignup(): string {
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Semi Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Medium'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});

  const screen = figma.createFrame();
  screen.name = 'Screen/Signup';
  screen.resize(1440, 900);
  screen.fills = [{type:'SOLID',color:${PC.bg}}];

  const card = figma.createFrame();
  card.name = 'Signup Card';
  card.resize(440, 560);
  card.fills = [{type:'SOLID',color:${PC.surface}}];
  card.cornerRadius = 16;
  card.strokes = [{type:'SOLID',color:${PC.border}}];
  card.strokeWeight = 1;
  card.x = 500; card.y = 170;

  const heading = figma.createText();
  heading.fontName = {family:'Inter',style:'Bold'};
  heading.characters = '회원가입';
  heading.fontSize = 28;
  heading.fills = [{type:'SOLID',color:${PC.text}}];
  heading.x = 40; heading.y = 40;

  card.appendChild(heading);

  const fields = [
    {label:'이름', y:100},
    {label:'이메일', y:170},
    {label:'비밀번호', y:240},
    {label:'비밀번호 확인', y:310},
  ];

  for (const fd of fields) {
    const lbl = figma.createText();
    lbl.fontName = {family:'Inter',style:'Medium'};
    lbl.characters = fd.label; lbl.fontSize = 12;
    lbl.fills = [{type:'SOLID',color:${PC.text}}];
    lbl.x = 40; lbl.y = fd.y;

    const field = figma.createFrame();
    field.resize(360, 40);
    field.fills = [{type:'SOLID',color:${PC.surfaceDim}}];
    field.cornerRadius = 8;
    field.strokes = [{type:'SOLID',color:${PC.border}}];
    field.strokeWeight = 1;
    field.x = 40; field.y = fd.y + 20;

    card.appendChild(lbl);
    card.appendChild(field);
  }

  const btn = figma.createFrame();
  btn.name = 'Button/Signup';
  btn.resize(360, 44);
  btn.fills = [{type:'SOLID',color:${PC.primary}}];
  btn.cornerRadius = 8;
  btn.layoutMode = 'HORIZONTAL';
  btn.primaryAxisAlignItems = 'CENTER';
  btn.counterAxisAlignItems = 'CENTER';
  btn.x = 40; btn.y = 472;
  const bt = figma.createText();
  bt.fontName = {family:'Inter',style:'Semi Bold'};
  bt.characters = '계정 만들기'; bt.fontSize = 14;
  bt.fills = [{type:'SOLID',color:${PC.white}}];
  btn.appendChild(bt);
  card.appendChild(btn);

  screen.appendChild(card);
  figma.currentPage.appendChild(screen);
  figma.viewport.scrollAndZoomIntoView([screen]);
  figma.closePlugin('✅ 회원가입 스크린 생성 완료!');
})();`
}

function genGenericScreen(prompt: string): string {
  const safePrompt = prompt.replace(/'/g, "\\'").slice(0, 50)
  return `(async () => {
  await figma.loadFontAsync({family:'Inter',style:'Bold'});
  await figma.loadFontAsync({family:'Inter',style:'Regular'});
  const screen = figma.createFrame();
  screen.name = 'Screen/Page';
  screen.resize(1440, 900);
  screen.fills = [{type:'SOLID',color:${PC.bg}}];

  const ttl = figma.createText();
  ttl.fontName = {family:'Inter',style:'Bold'};
  ttl.characters = '페이지 제목';
  ttl.fontSize = 36;
  ttl.fills = [{type:'SOLID',color:${PC.text}}];
  ttl.x = 48; ttl.y = 60;

  const sub = figma.createText();
  sub.fontName = {family:'Inter',style:'Regular'};
  sub.characters = '${safePrompt}';
  sub.fontSize = 16;
  sub.fills = [{type:'SOLID',color:${PC.muted}}];
  sub.x = 48; sub.y = 112;

  const content = figma.createFrame();
  content.name = 'ContentArea';
  content.resize(1344, 650);
  content.fills = [{type:'SOLID',color:${PC.surface}}];
  content.cornerRadius = 12;
  content.strokes = [{type:'SOLID',color:${PC.border}}];
  content.strokeWeight = 1;
  content.x = 48; content.y = 160;

  screen.appendChild(ttl);
  screen.appendChild(sub);
  screen.appendChild(content);
  figma.currentPage.appendChild(screen);
  figma.viewport.scrollAndZoomIntoView([screen]);
  figma.closePlugin('✅ 스크린 생성 완료!');
})();`
}

function generatePluginCode(prompt: string, mode: 'component' | 'screen'): string {
  const lower = prompt.toLowerCase()
  if (mode === 'component') {
    if (lower.includes('버튼') || lower.includes('button') || lower.includes('btn')) return genButton(prompt)
    if (lower.includes('카드') || lower.includes('card')) return genCard(prompt)
    if (lower.includes('인풋') || lower.includes('input') || lower.includes('입력') || lower.includes('필드') || lower.includes('field')) return genInput(prompt)
    if (lower.includes('모달') || lower.includes('modal') || lower.includes('다이얼로그') || lower.includes('dialog')) return genModal(prompt)
    if (lower.includes('배지') || lower.includes('badge') || lower.includes('태그') || lower.includes('chip')) return genBadge(prompt)
    if (lower.includes('네비') || lower.includes('nav') || lower.includes('헤더') || lower.includes('header') || lower.includes('메뉴')) return genNav(prompt)
    return genGenericComponent(prompt)
  } else {
    if (lower.includes('로그인') || lower.includes('login') || lower.includes('sign in') || lower.includes('signin')) return genLogin()
    if (lower.includes('대시보드') || lower.includes('dashboard') || lower.includes('홈') || lower.includes('메인')) return genDashboard()
    if (lower.includes('회원가입') || lower.includes('signup') || lower.includes('sign up') || lower.includes('가입') || lower.includes('register')) return genSignup()
    return genGenericScreen(prompt)
  }
}

function detectFrameType(prompt: string, mode: 'component' | 'screen'): string {
  const lower = prompt.toLowerCase()
  if (mode === 'component') {
    if (lower.includes('버튼') || lower.includes('button')) return '버튼 컴포넌트'
    if (lower.includes('카드') || lower.includes('card')) return '카드 컴포넌트'
    if (lower.includes('인풋') || lower.includes('input') || lower.includes('입력')) return '인풋 컴포넌트'
    if (lower.includes('모달') || lower.includes('modal')) return '모달 컴포넌트'
    if (lower.includes('배지') || lower.includes('badge')) return '배지 컴포넌트'
    if (lower.includes('네비') || lower.includes('nav') || lower.includes('헤더')) return '네비게이션 컴포넌트'
    return 'UI 컴포넌트'
  } else {
    if (lower.includes('로그인') || lower.includes('login')) return '로그인 스크린'
    if (lower.includes('대시보드') || lower.includes('dashboard')) return '대시보드 스크린'
    if (lower.includes('회원가입') || lower.includes('signup')) return '회원가입 스크린'
    return '페이지 스크린'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as AgentBody
  const { prompt, mode, token, fileKey: rawFileKey } = body
  const fileKey = rawFileKey ? extractFileKey(rawFileKey) : null

  const encoder = new TextEncoder()
  const taskId = uuidv4()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sse(data)))

      send({ text: '요청을 분석하는 중입니다...\n\n' })
      await delay(350)

      const modeLabel = mode === 'component' ? '컴포넌트' : '스크린'
      send({ text: `**${modeLabel} 생성 모드**로 작업을 시작합니다.\n\n` })
      await delay(250)

      send({ text: `📋 요청: "${prompt}"\n\n` })
      await delay(300)

      let figmaFileName = ''
      let figmaLink = ''
      let figmaConnected = false
      let dsTokens: DSTokens = {
        fontStyles: {},
        radiusSm: HARDCODED.radiusSm,
        radiusMd: HARDCODED.radiusMd,
        radiusLg: HARDCODED.radiusLg,
        radiusFull: HARDCODED.radiusFull,
        spacingSm: HARDCODED.spacingSm,
        spacingMd: HARDCODED.spacingMd,
        spacingLg: HARDCODED.spacingLg,
        appliedRoles: [],
      }

      if (token && fileKey) {
        send({ text: '🔗 Figma 파일에 연결하는 중...\n' })
        await delay(300)

        const fileData = await readFigmaFile(token, fileKey)
        if (fileData) {
          figmaConnected = true
          figmaFileName = fileData.name
          const pageCount = fileData.document?.children?.length ?? 0
          figmaLink = `https://www.figma.com/design/${fileKey}/`
          send({ text: `✅ Figma 연결 성공: **${figmaFileName}** (${pageCount}개 페이지)\n\n` })
          await delay(200)

          // Step 1: Try Figma Variables (most accurate, needs Professional+ plan)
          send({ text: '🔍 디자인 시스템 Variables를 읽는 중...\n' })
          const { vars, collections } = await getDSVariables(token, fileKey)

          if (vars.length > 0) {
            dsTokens = applyVariablesToTokens(vars, collections, dsTokens)
            const colorCount = vars.filter((v) => v.resolvedType === 'COLOR').length
            const numCount = vars.filter((v) => v.resolvedType === 'FLOAT').length
            send({ text: `✅ Variables 적용 — 컬러 **${colorCount}개**, 숫자 **${numCount}개**\n` })
            if (dsTokens.appliedRoles.length > 0) {
              send({ text: `   ${dsTokens.appliedRoles.join(' · ')}\n\n` })
            } else {
              send({ text: `   ※ 토큰 이름 패턴이 매칭되지 않아 색상 역할을 자동 인식하지 못했습니다.\n\n` })
            }
          } else {
            // Step 2: Fall back to Styles + Component node inspection
            send({ text: 'ℹ️ Variables 없음 (Professional+ 플랜 필요) — 스타일에서 토큰 추출 중...\n' })
            const [allStyles, allComponents] = await Promise.all([
              getDSStyles(token, fileKey),
              getDSComponents(token, fileKey),
            ])

            if (allStyles.length > 0 || allComponents.length > 0) {
              const [styleValues, compTokens] = await Promise.all([
                getDSStyleValues(token, fileKey, allStyles),
                getDSComponentTokens(token, fileKey, allComponents),
              ])
              dsTokens = extractTokens(styleValues, compTokens)

              if (dsTokens.appliedRoles.length > 0) {
                send({ text: `✅ 스타일 토큰 적용 — ${dsTokens.appliedRoles.join(' · ')}\n\n` })
              } else {
                send({ text: `ℹ️ 스타일 ${allStyles.length}개 발견, 토큰 역할 인식 실패. 기본값으로 진행합니다.\n\n` })
              }
            } else {
              send({ text: 'ℹ️ DS 파일에서 스타일/컴포넌트를 찾을 수 없습니다. 기본값으로 진행합니다.\n\n' })
            }
          }
          await delay(200)
        } else {
          send({ text: '⚠️ Figma 파일 연결 실패. PAT 또는 파일 URL을 확인해주세요.\n\n' })
          await delay(300)
        }
      } else {
        send({ text: '⚠️ Settings에서 Figma PAT와 파일 URL을 설정하면 DS 컬러·폰트·간격을 자동 적용할 수 있습니다.\n\n' })
        await delay(300)
      }

      const frameType = detectFrameType(prompt, mode)
      send({ text: `🎨 ${frameType} 프레임을 생성하는 중...\n` })
      await delay(500)

      // Generate code and apply full DS token set
      const rawCode = generatePluginCode(prompt, mode)
      const pluginCode = dsTokens.appliedRoles.length > 0
        ? applyTokens(rawCode, dsTokens)
        : rawCode

      const usedDS = dsTokens.appliedRoles.length > 0
      const codeNote = usedDS
        ? `아래 코드는 **디자인 시스템 토큰(컬러·폰트·간격·radius)이 적용된** 코드입니다. Framemate 플러그인에서 실행하세요:`
        : `아래 코드를 Framemate 플러그인에서 실행하세요:`

      send({ text: `✅ 생성 완료!\n\n${codeNote}\n\n\`\`\`javascript\n${pluginCode}\n\`\`\`\n\n` })
      await delay(300)

      if (figmaConnected && token && fileKey) {
        const commentMsg = [
          `[Framemate] ${modeLabel} 생성`,
          ``,
          `요청: ${prompt}`,
          `유형: ${frameType}`,
          usedDS ? `DS 토큰: ${dsTokens.appliedRoles.join(', ')}` : 'DS 토큰: 미적용',
          `생성 시각: ${new Date().toLocaleString('ko-KR')}`,
          `Task ID: ${taskId}`,
        ].join('\n')

        const commented = await postFigmaComment(token, fileKey, commentMsg)
        if (commented) {
          send({ text: '💬 Figma 파일에 코멘트를 남겼습니다.\n\n' })
          await delay(150)
        }
      }

      const finalText = figmaConnected
        ? usedDS
          ? `✨ **${figmaFileName}**의 컬러·폰트가 적용된 코드가 준비됐습니다. Framemate 플러그인에서 실행하세요.`
          : `✨ **${figmaFileName}** 파일 연결 완료. Framemate 플러그인에서 위 코드를 실행하세요.`
        : `✨ 위 코드를 Framemate 플러그인에서 실행하면 ${frameType}가 캔버스에 생성됩니다.`

      send({
        text: finalText,
        taskId,
        figmaLink: figmaLink || undefined,
      })

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
