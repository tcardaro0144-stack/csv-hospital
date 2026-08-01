/**
 * Map Stripe SDK errors to safe client-facing messages.
 */
export function stripeCheckoutErrorMessage(error) {
  const code = error?.code || error?.raw?.code
  const message = String(error?.message || '')

  if (code === 'resource_missing' || /No such price/i.test(message)) {
    return 'Stripe price not found. Check STRIPE_PRICE_ID matches your Dashboard (same mode as STRIPE_SECRET_KEY — test vs live).'
  }

  if (code === 'invalid_request_error' || /Invalid.*[Pp]rice/i.test(message)) {
    return 'Invalid Stripe price configuration for this plan.'
  }

  return 'Unable to create checkout session.'
}
