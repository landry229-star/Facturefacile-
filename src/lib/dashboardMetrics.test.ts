import { describe, expect, it } from 'vitest'
import { formatPeriodComparison, getMonthToDateComparisonPeriods } from './dashboardMetrics'

describe('dashboard period metrics', () => {
  it('compares equal elapsed dates in the current and previous month', () => {
    expect(getMonthToDateComparisonPeriods(new Date(2026, 9, 17))).toEqual({
      current: { from: '2026-10-01', to: '2026-10-18', label: '1 oct.–17 oct. 2026' },
      previous: { from: '2026-09-01', to: '2026-09-18', label: '1 sept.–17 sept. 2026' },
    })
  })

  it('caps the previous period at the last day of a shorter month', () => {
    expect(getMonthToDateComparisonPeriods(new Date(2026, 2, 31))).toEqual({
      current: { from: '2026-03-01', to: '2026-04-01', label: '1 mars–31 mars 2026' },
      previous: { from: '2026-02-01', to: '2026-03-01', label: '1 févr.–28 févr. 2026' },
    })
  })

  it('labels zero-baseline comparisons without dividing by zero', () => {
    expect(formatPeriodComparison(0, 0)).toEqual({ label: 'Stable (0)', trend: 'up' })
    expect(formatPeriodComparison(2500, 0)).toEqual({ label: 'Nouveau · +2 500', trend: 'up' })
    expect(formatPeriodComparison(75, 100)).toEqual({ label: '-25% vs période précédente', trend: 'down' })
  })
})
