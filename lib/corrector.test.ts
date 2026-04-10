import { describe, it, expect } from 'vitest'
import { applyCorrections, isEmpty } from './corrector'
import type { ColumnReview } from '@/types/field'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRows(): Record<string, unknown>[] {
  return [
    { color: 'green', size: 'M', qty: 10 },
    { color: 'Green', size: 'L', qty: 20 },
    { color: 'GREEN', size: 'S', qty: 5 },
  ]
}

// ---------------------------------------------------------------------------
// isEmpty
// ---------------------------------------------------------------------------

describe('isEmpty', () => {
  it('returns true for null', () => expect(isEmpty(null)).toBe(true))
  it('returns true for undefined', () => expect(isEmpty(undefined)).toBe(true))
  it('returns true for empty string', () => expect(isEmpty('')).toBe(true))
  it('returns true for whitespace-only string', () => expect(isEmpty('   ')).toBe(true))
  it('returns false for non-empty string', () => expect(isEmpty('x')).toBe(false))
  it('returns false for zero', () => expect(isEmpty(0)).toBe(false))
  it('returns false for false', () => expect(isEmpty(false)).toBe(false))
})

// ---------------------------------------------------------------------------
// applyCorrections — core behaviour
// ---------------------------------------------------------------------------

describe('applyCorrections', () => {
  it('returns rows unchanged when reviews array is empty', () => {
    const rows = makeRows()
    const result = applyCorrections(rows, [])
    expect(result).toEqual(rows)
  })

  it('does not mutate the original row array', () => {
    const rows = makeRows()
    const original = JSON.parse(JSON.stringify(rows))
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [{ sourceFile: 'test.csv', columnName: 'color', rowIndex: 0, originalValue: 'green', correctedValue: 'Blue' }],
    }
    applyCorrections(rows, [review])
    expect(rows).toEqual(original)
  })

  it('accepted review leaves all values in that column unchanged', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'accepted',
      corrections: [],
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.color)).toEqual(['green', 'Green', 'GREEN'])
  })

  it('corrected review applies corrections at the correct row indices', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: 1, originalValue: 'Green', correctedValue: 'blue' },
      ],
    }
    const result = applyCorrections(rows, [review])
    expect(result[0].color).toBe('green')
    expect(result[1].color).toBe('blue')
    expect(result[2].color).toBe('GREEN')
  })

  it('corrections do not affect other columns', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: 0, originalValue: 'green', correctedValue: 'red' },
      ],
    }
    const result = applyCorrections(rows, [review])
    expect(result[0].size).toBe('M')
    expect(result[0].qty).toBe(10)
  })

  it('corrections do not affect rows not in the corrections array', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: 0, originalValue: 'green', correctedValue: 'red' },
      ],
    }
    const result = applyCorrections(rows, [review])
    expect(result[1].color).toBe('Green')
    expect(result[2].color).toBe('GREEN')
  })

  it('a corrected review with zero corrections leaves the column unchanged', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [],
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.color)).toEqual(['green', 'Green', 'GREEN'])
  })

  it('out-of-bounds rowIndex is silently skipped', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: 99, originalValue: 'x', correctedValue: 'y' },
      ],
    }
    const result = applyCorrections(rows, [review])
    expect(result).toEqual(rows)
  })

  it('multiple reviews on different columns both apply correctly', () => {
    const rows = makeRows()
    const reviews: ColumnReview[] = [
      {
        sourceFile: 'test.csv',
        columnName: 'color',
        status: 'corrected',
        corrections: [
          { sourceFile: 'test.csv', columnName: 'color', rowIndex: 0, originalValue: 'green', correctedValue: 'red' },
        ],
      },
      {
        sourceFile: 'test.csv',
        columnName: 'size',
        status: 'corrected',
        corrections: [
          { sourceFile: 'test.csv', columnName: 'size', rowIndex: 2, originalValue: 'S', correctedValue: 'XL' },
        ],
      },
    ]
    const result = applyCorrections(rows, reviews)
    expect(result[0].color).toBe('red')
    expect(result[2].size).toBe('XL')
    // Other values untouched
    expect(result[1].color).toBe('Green')
    expect(result[0].size).toBe('M')
  })
})

// ---------------------------------------------------------------------------
// rowIndex: -1 sentinel (entire-column corrections)
// ---------------------------------------------------------------------------

describe('applyCorrections — rowIndex: -1 sentinel', () => {
  it('rowIndex: -1 applies correctedValue to every row in the column', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: -1, originalValue: '', correctedValue: 'N/A' },
      ],
    }
    const result = applyCorrections(rows, [review])
    expect(result.every(r => r.color === 'N/A')).toBe(true)
  })

  it('rowIndex: -1 does not affect other columns', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: -1, originalValue: '', correctedValue: 'N/A' },
      ],
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.size)).toEqual(['M', 'L', 'S'])
  })
})

// ---------------------------------------------------------------------------
// formatRule (capitalisation corrections)
// ---------------------------------------------------------------------------

describe('applyCorrections — formatRule', () => {
  it('UPPERCASE applies to all cells in the column', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [],
      formatRule: 'UPPERCASE',
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.color)).toEqual(['GREEN', 'GREEN', 'GREEN'])
  })

  it('lowercase applies to all cells in the column', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [],
      formatRule: 'lowercase',
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.color)).toEqual(['green', 'green', 'green'])
  })

  it('Title Case applies to all cells in the column', () => {
    const rows = [
      { color: 'forest green', size: 'M' },
      { color: 'SKY BLUE', size: 'L' },
    ]
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [],
      formatRule: 'Title Case',
    }
    const result = applyCorrections(rows, [review])
    expect(result[0].color).toBe('Forest Green')
    expect(result[1].color).toBe('Sky Blue')
  })

  it('per-cell corrections override formatRule for specific rows', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [
        // override row 1 after UPPERCASE is applied
        { sourceFile: 'test.csv', columnName: 'color', rowIndex: 1, originalValue: 'Green', correctedValue: 'Blue' },
      ],
      formatRule: 'UPPERCASE',
    }
    const result = applyCorrections(rows, [review])
    expect(result[0].color).toBe('GREEN')   // formatRule applied
    expect(result[1].color).toBe('Blue')    // per-cell override wins
    expect(result[2].color).toBe('GREEN')   // formatRule applied
  })

  it('formatRule does not affect other columns', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'corrected',
      corrections: [],
      formatRule: 'UPPERCASE',
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.size)).toEqual(['M', 'L', 'S'])
  })

  it('accepted review with formatRule still leaves column unchanged', () => {
    const rows = makeRows()
    const review: ColumnReview = {
      sourceFile: 'test.csv',
      columnName: 'color',
      status: 'accepted',
      corrections: [],
      formatRule: 'UPPERCASE',
    }
    const result = applyCorrections(rows, [review])
    expect(result.map(r => r.color)).toEqual(['green', 'Green', 'GREEN'])
  })
})
