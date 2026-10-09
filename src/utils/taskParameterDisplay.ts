export function parseParameterDisplay(value: string): unknown {
  // Parse only already-formatted visible values, never reload raw task parameters.
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed !== null && typeof parsed === 'object') return parsed
  } catch { /* Plain text stays unchanged. */ }
  return value
}
