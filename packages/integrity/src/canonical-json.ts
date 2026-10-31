// Deterministic JSON (RFC 8785 subset): object keys sorted by UTF-16 code units,
// numbers and strings serialized the ECMAScript way. Client and server must hash identical bytes,
// so anything that JSON would silently change (class instances, holes, lone surrogates) is rejected.
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string') {
    if (!value.isWellFormed()) throw new TypeError('Cannot canonicalize a string with lone surrogates')
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) throw new TypeError('Cannot canonicalize a sparse array')
    }
    return `[${value.map(canonicalize).join(',')}]`
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${canonicalize(k)}:${canonicalize(v)}`).join(',')}}`
  }
  throw new TypeError(`Cannot canonicalize a value of type ${typeof value}`)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
