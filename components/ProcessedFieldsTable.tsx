'use client'

import { useState } from 'react'
import type { Field } from '@/types/field'

interface ProcessedFieldsTableProps {
  fields: Field[]  // only clean fields
}

export default function ProcessedFieldsTable({ fields }: ProcessedFieldsTableProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (fields.length === 0) return null

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section header — clickable to collapse */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          marginBottom: '12px',
        }}
      >
        <span className="label">Processed fields ({fields.length})</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            color: 'var(--color-text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path
            d="M 2 4 L 6 8 L 10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            background: 'var(--color-white)',
            border: '0.5px solid var(--color-border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}
          >
            <thead>
              <tr>
                {['Field', 'Extracted value', 'Source', 'Status'].map((col, i) => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      fontSize: '10px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--color-text-muted)',
                      padding: '8px 14px',
                      borderBottom: '0.5px solid var(--color-border-default)',
                      background: 'var(--color-white)',
                      width: i === 0 ? '26%' : i === 1 ? '36%' : i === 2 ? '26%' : '12%',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => {
                const isLast = i === fields.length - 1
                return (
                  <tr key={field.id}>
                    <td
                      style={{
                        padding: '8px 14px',
                        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-default)',
                        color: 'var(--color-text-muted)',
                        verticalAlign: 'middle',
                      }}
                    >
                      {field.label}
                    </td>
                    <td
                      style={{
                        padding: '8px 14px',
                        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)',
                        fontWeight: 500,
                        verticalAlign: 'middle',
                      }}
                    >
                      {field.interpretedValue ?? field.rawValue ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '8px 14px',
                        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-default)',
                        verticalAlign: 'middle',
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}
                      >
                        {field.sourceFile ?? '—'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 14px',
                        borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-default)',
                        verticalAlign: 'middle',
                      }}
                    >
                      <span className="badge badge-clean">CLEAN</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
