// lib/profiler-config.ts
// Threshold constants for the Distil data profiler.
// Each constant is named for what it controls.
// Adjust here only — do not hardcode thresholds elsewhere.

export const OUTLIER_STD_DEVIATIONS = 3
// Numeric values more than this many standard deviations from the column mean are flagged as outliers.
// Higher = less sensitive. Lower = more sensitive.

export const MIN_CAPITALISATION_VARIANTS = 2
// Flag capitalisation inconsistency if a column contains this many or more distinct
// capitalisation variants of what appear to be the same value.
// e.g. GREEN, Green, green = 3 variants → flagged at threshold 2

export const PLACEHOLDER_VALUES = [
  'n/a', 'na', 'null', 'nil', 'none', 'tbc', 'tbd', 'tba',
  'unknown', 'pending', 'todo', 'to do', '-', '--', '---',
  '_', '__', '?', '??', '#n/a', '#null!', '#value!', '#ref!',
  '(blank)', '[blank]', '[empty]', '[none]'
]
// Case-insensitive. Whitespace-trimmed before comparison.
// Add new placeholder patterns here as they are discovered in real data.
