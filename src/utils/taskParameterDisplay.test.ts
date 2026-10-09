import { expect, it } from 'vitest'
import { parseParameterDisplay } from './taskParameterDisplay'

it('parses structured display values without changing plain text or redaction', () => {
  expect(parseParameterDisplay('{"body":"hello\\nworld","items":[1,2]}')).toEqual({ body: 'hello\nworld', items: [1, 2] })
  for (const text of ['[REDACTED]', '123', 'null', 'line 1\nline 2', '{invalid']) {
    expect(parseParameterDisplay(text)).toBe(text)
  }
})
