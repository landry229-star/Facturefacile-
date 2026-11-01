import { describe, expect, it, vi } from 'vitest'
import { hasFeatureForUser, hasSubscriptionFeature, isDemoOwnerOverride, resolveEffectiveSubscriptionState, subscriptionLimits } from './subscription'

describe('subscription feature access', () => {
  it('allows recurring invoices on paid plans but not the free plan', () => {
    expect(hasSubscriptionFeature('free', 'recurringInvoices')).toBe(false)
    expect(hasSubscriptionFeature('starter', 'recurringInvoices')).toBe(true)
    expect(hasSubscriptionFeature('pro', 'recurringInvoices')).toBe(true)
    expect(hasSubscriptionFeature('business', 'recurringInvoices')).toBe(true)
    expect(hasFeatureForUser('free', 'recurringInvoices', 'other@facturefacile.bj')).toBe(false)
  })

  it('restricts team and audit access to paid plans', () => {
    expect(hasSubscriptionFeature('starter', 'team')).toBe(false)
    expect(hasSubscriptionFeature('pro', 'team')).toBe(true)
    expect(hasSubscriptionFeature('pro', 'audit')).toBe(true)
    expect(hasSubscriptionFeature('business', 'team')).toBe(true)
  })

  it('limits stock, reports and exports by plan', () => {
    expect(hasSubscriptionFeature('free', 'stock')).toBe(false)
    expect(hasSubscriptionFeature('starter', 'stock')).toBe(true)
    expect(hasSubscriptionFeature('free', 'reports')).toBe(false)
    expect(hasSubscriptionFeature('pro', 'exports')).toBe(true)
  })

  it('allows the configured owner demo email to preview every feature', () => {
    vi.stubEnv('VITE_OWNER_DEMO_EMAIL', 'owner@facturefacile.bj')
    expect(isDemoOwnerOverride('owner@facturefacile.bj')).toBe(true)
    expect(hasFeatureForUser('free', 'reports', 'owner@facturefacile.bj')).toBe(true)
    expect(hasFeatureForUser('free', 'audit', 'owner@facturefacile.bj')).toBe(true)
    expect(hasFeatureForUser('free', 'stock', 'other@facturefacile.bj')).toBe(false)
    vi.unstubAllEnvs()
  })

  it('keeps plan limits monotonic and defines the business tier', () => {
    expect(subscriptionLimits.free.invoices).toBeLessThan(subscriptionLimits.starter.invoices)
    expect(subscriptionLimits.starter.invoices).toBeLessThan(subscriptionLimits.pro.invoices)
    expect(subscriptionLimits.pro.invoices).toBeLessThan(subscriptionLimits.business.invoices)
    expect(subscriptionLimits.business.members).toBeGreaterThan(subscriptionLimits.pro.members)
  })

  it('downgrades an expired paid plan to free at the exact expiry instant', () => {
    const expiresAt = '2026-10-17T16:00:00.000Z'
    const state = resolveEffectiveSubscriptionState(
      { plan: 'pro', status: 'active', expires_at: expiresAt },
      new Date(expiresAt),
    )

    expect(state.plan).toBe('free')
    expect(state.isPaid).toBe(false)
    expect(state.status).toBe('expired')
  })

  it('does not grant paid features when the expiry date is invalid', () => {
    const state = resolveEffectiveSubscriptionState(
      { plan: 'starter', status: 'active', expires_at: 'not-a-date' },
      new Date('2026-10-17T16:00:00.000Z'),
    )

    expect(state.plan).toBe('free')
    expect(state.isPaid).toBe(false)
  })
})
