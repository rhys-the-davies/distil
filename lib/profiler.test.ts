// lib/profiler.test.ts
// Run with: npx vitest run lib/profiler.test.ts
/// <reference types="vitest/globals" />

import { profileFile } from './profiler'
import type { FileCharacterisation } from '@/types/profiler'

const baseChar: FileCharacterisation = {
  fileType: 'test file',
  domain: 'testing',
  primaryKeyColumn: null,
  columnRoles: {},
  notes: [],
}

function char(roles: Record<string, string> = {}): FileCharacterisation {
  return { ...baseChar, columnRoles: roles }
}

// ── Empty input ───────────────────────────────────────────────────────────────

describe('profileFile — empty input', () => {
  it('returns empty result when rows array is empty', () => {
    const result = profileFile([], baseChar)
    expect(result.columns).toEqual([])
    expect(result.cleanColumns).toEqual([])
    expect(result.flaggedColumns).toEqual([])
    expect(result.duplicateRowCount).toBe(0)
    expect(result.characterisation).toBe(baseChar)
  })
})

// ── Column role assignment ────────────────────────────────────────────────────

describe('profileFile — column roles', () => {
  it('assigns role from characterisation.columnRoles', () => {
    const rows = [{ Color: 'Red' }]
    const result = profileFile(rows, char({ Color: 'variant' }))
    expect(result.columns[0].role).toBe('variant')
  })

  it('defaults to "unknown" when column has no role', () => {
    const rows = [{ Color: 'Red' }]
    const result = profileFile(rows, char())
    expect(result.columns[0].role).toBe('unknown')
  })
})

// ── Empty cells ───────────────────────────────────────────────────────────────

describe('empty_cells', () => {
  it('flags partial empty cells', () => {
    const rows = [{ A: 'hello' }, { A: null }, { A: '' }, { A: '   ' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'empty_cells')
    expect(flag).toBeDefined()
    expect(flag!.count).toBe(3)
    expect(flag!.total).toBe(4)
  })

  it('does not flag empty_cells when column is fully populated', () => {
    const rows = [{ A: 'x' }, { A: 'y' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'empty_cells')
    expect(flag).toBeUndefined()
  })
})

// ── Entire column empty ───────────────────────────────────────────────────────

describe('entire_column_empty', () => {
  it('flags entire_column_empty when all values are null/empty', () => {
    const rows = [{ A: null }, { A: '' }, { A: '   ' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'entire_column_empty')
    expect(flag).toBeDefined()
    expect(flag!.count).toBe(3)
  })

  it('does not also raise empty_cells when entire_column_empty fires', () => {
    const rows = [{ A: null }, { A: null }]
    const result = profileFile(rows, baseChar)
    const types = result.columns[0].flags.map((f) => f.type)
    expect(types).toContain('entire_column_empty')
    expect(types).not.toContain('empty_cells')
  })
})

// ── Placeholder values ────────────────────────────────────────────────────────

describe('placeholder_values', () => {
  it('flags partial placeholder values', () => {
    const rows = [{ A: 'N/A' }, { A: 'real value' }, { A: 'TBC' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'placeholder_values')
    expect(flag).toBeDefined()
    expect(flag!.count).toBe(2)
  })

  it('is case-insensitive', () => {
    const rows = [{ A: 'n/a' }, { A: 'N/A' }, { A: 'NULL' }, { A: 'real' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'placeholder_values')
    expect(flag!.count).toBe(3)
  })

  it('does not flag empty cells as placeholders', () => {
    const rows = [{ A: '' }, { A: null }, { A: 'good' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'placeholder_values')
    expect(flag).toBeUndefined()
  })
})

// ── Entire column placeholder ─────────────────────────────────────────────────

describe('entire_column_placeholder', () => {
  it('flags entire_column_placeholder when all values are placeholders', () => {
    const rows = [{ A: 'N/A' }, { A: 'TBC' }, { A: 'unknown' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'entire_column_placeholder')
    expect(flag).toBeDefined()
  })

  it('does not also raise placeholder_values when entire_column_placeholder fires', () => {
    const rows = [{ A: 'N/A' }, { A: 'N/A' }]
    const result = profileFile(rows, baseChar)
    const types = result.columns[0].flags.map((f) => f.type)
    expect(types).toContain('entire_column_placeholder')
    expect(types).not.toContain('placeholder_values')
  })
})

// ── Capitalisation inconsistency ──────────────────────────────────────────────

describe('capitalisation_inconsistency', () => {
  it('flags when the same value appears with different capitalisation', () => {
    const rows = [{ Color: 'Green' }, { Color: 'GREEN' }, { Color: 'green' }, { Color: 'Blue' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'capitalisation_inconsistency')
    expect(flag).toBeDefined()
    expect(flag!.examples).toEqual(expect.arrayContaining(['Green', 'GREEN', 'green']))
  })

  it('does not flag when all values share the same casing', () => {
    const rows = [{ Color: 'Green' }, { Color: 'Blue' }, { Color: 'Red' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'capitalisation_inconsistency')
    expect(flag).toBeUndefined()
  })

  it('does not flag numeric columns for capitalisation', () => {
    const rows = [{ Qty: 1 }, { Qty: 2 }, { Qty: 3 }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'capitalisation_inconsistency')
    expect(flag).toBeUndefined()
  })
})

// ── Numeric outliers ──────────────────────────────────────────────────────────

describe('numeric_outlier', () => {
  it('flags obvious outlier values', () => {
    // 9 values tightly clustered, one extreme outlier
    const rows = [
      { Val: 10 }, { Val: 11 }, { Val: 10 }, { Val: 12 }, { Val: 10 },
      { Val: 11 }, { Val: 10 }, { Val: 11 }, { Val: 10 }, { Val: 9999 },
    ]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'numeric_outlier')
    expect(flag).toBeDefined()
    expect(flag!.examples[0]).toBe('9999')
  })

  it('does not flag when all values are close together', () => {
    const rows = [{ Val: 10 }, { Val: 11 }, { Val: 10 }, { Val: 12 }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'numeric_outlier')
    expect(flag).toBeUndefined()
  })

  it('does not flag outliers on non-numeric columns', () => {
    const rows = [{ Tag: 'apple' }, { Tag: 'banana' }, { Tag: 'cherry' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'numeric_outlier')
    expect(flag).toBeUndefined()
  })
})

// ── Mixed types ───────────────────────────────────────────────────────────────

describe('mixed_types', () => {
  it('flags when a column contains both strings and numbers', () => {
    const rows = [{ A: 'hello' }, { A: 42 }, { A: 'world' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'mixed_types')
    expect(flag).toBeDefined()
  })

  it('does not flag when all values are the same type', () => {
    const rows = [{ A: 1 }, { A: 2 }, { A: 3 }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'mixed_types')
    expect(flag).toBeUndefined()
  })
})

// ── Duplicate rows ────────────────────────────────────────────────────────────

describe('duplicate rows', () => {
  it('counts duplicate rows correctly', () => {
    const rows = [
      { A: 'x', B: 1 },
      { A: 'x', B: 1 }, // duplicate
      { A: 'y', B: 2 },
      { A: 'y', B: 2 }, // duplicate
      { A: 'y', B: 2 }, // duplicate
    ]
    const result = profileFile(rows, baseChar)
    // 1 extra copy of A/1, 2 extra copies of y/2 = 3 total duplicates
    expect(result.duplicateRowCount).toBe(3)
  })

  it('returns 0 when no rows are duplicated', () => {
    const rows = [{ A: 'x' }, { A: 'y' }, { A: 'z' }]
    const result = profileFile(rows, baseChar)
    expect(result.duplicateRowCount).toBe(0)
  })
})

// ── Truncated values ──────────────────────────────────────────────────────────

describe('truncated_values', () => {
  it('flags values ending in ...', () => {
    const rows = [{ A: 'This is truncated...' }, { A: 'Normal value' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'truncated_values')
    expect(flag).toBeDefined()
    expect(flag!.count).toBe(1)
  })

  it('flags values ending in the ellipsis character', () => {
    const rows = [{ A: 'Truncated…' }, { A: 'Normal' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'truncated_values')
    expect(flag).toBeDefined()
  })

  it('does not flag normal values', () => {
    const rows = [{ A: 'Complete value' }, { A: 'Another value' }]
    const result = profileFile(rows, baseChar)
    const flag = result.columns[0].flags.find((f) => f.type === 'truncated_values')
    expect(flag).toBeUndefined()
  })
})

// ── Clean vs flagged columns ──────────────────────────────────────────────────

describe('cleanColumns and flaggedColumns', () => {
  it('correctly separates clean and flagged columns', () => {
    const rows = [
      { Good: 'apple', Bad: null },
      { Good: 'banana', Bad: null },
    ]
    const result = profileFile(rows, baseChar)
    expect(result.cleanColumns).toContain('Good')
    expect(result.flaggedColumns).toContain('Bad')
    expect(result.cleanColumns).not.toContain('Bad')
    expect(result.flaggedColumns).not.toContain('Good')
  })
})

// ── Column statistics ─────────────────────────────────────────────────────────

describe('column statistics', () => {
  it('calculates populatedCount and uniqueValues correctly', () => {
    const rows = [
      { A: 'apple' },
      { A: 'banana' },
      { A: 'apple' },
      { A: null },
    ]
    const result = profileFile(rows, baseChar)
    const col = result.columns[0]
    expect(col.populatedCount).toBe(3)
    expect(col.uniqueValues).toBe(2)
    expect(col.totalCount).toBe(4)
  })

  it('returns up to 5 sample values, deduplicated', () => {
    const rows = [
      { A: 'a' }, { A: 'b' }, { A: 'c' }, { A: 'd' }, { A: 'e' }, { A: 'f' }, { A: 'a' },
    ]
    const result = profileFile(rows, baseChar)
    expect(result.columns[0].sampleValues.length).toBeLessThanOrEqual(5)
  })
})
