import { useMemo, useState } from 'react'
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout'
import { loadStripe } from '@stripe/stripe-js'

function PaymentForm({ onPaid, onCancel, onError }) {
  const checkoutResult = useCheckoutElements()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [expressVisible, setExpressVisible] = useState(false)

  if (checkoutResult.type === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-mist)]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-signal)] border-t-transparent" />
        Loading wallet buttons…
      </div>
    )
  }

  if (checkoutResult.type === 'error') {
    return (
      <p className="text-sm text-red-300" role="alert">
        {checkoutResult.error.message || 'Unable to load Checkout.'}
      </p>
    )
  }

  const checkout = checkoutResult.checkout

  async function finishPaid() {
    const sessionId = checkout.id || checkout.sessionId
    await onPaid(sessionId)
  }

  async function handleExpressConfirm(event) {
    if (submitting) return
    setSubmitting(true)
    setMessage(null)

    try {
      const result = await checkout.confirm({
        expressCheckoutConfirmEvent: event,
      })

      if (result.type === 'error') {
        const msg = result.error?.message || 'Payment failed.'
        setMessage(msg)
        onError?.(msg)
        setSubmitting(false)
        return
      }

      await finishPaid()
      setSubmitting(false)
    } catch (error) {
      const msg = error?.message || 'Payment failed.'
      setMessage(msg)
      onError?.(msg)
      setSubmitting(false)
    }
  }

  async function handleCardSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setMessage(null)

    try {
      const result = await checkout.confirm()

      if (result.type === 'error') {
        const msg = result.error?.message || 'Payment failed.'
        setMessage(msg)
        onError?.(msg)
        setSubmitting(false)
        return
      }

      await finishPaid()
      setSubmitting(false)
    } catch (error) {
      const msg = error?.message || 'Payment failed.'
      setMessage(msg)
      onError?.(msg)
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="min-h-[48px]"
        style={{ visibility: expressVisible ? 'visible' : 'hidden' }}
        aria-hidden={!expressVisible}
      >
        <ExpressCheckoutElement
          onConfirm={handleExpressConfirm}
          onAvailablePaymentMethodsChange={({ paymentMethods }) => {
            setExpressVisible(Boolean(paymentMethods))
          }}
        />
      </div>

      {expressVisible ? (
        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-mist)]">
            Or pay with card
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}

      <form onSubmit={handleCardSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-mist)]">
            Contact
          </p>
          <ContactDetailsElement />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-mist)]">
            Card
          </p>
          <PaymentElement />
        </div>
        {message ? (
          <p className="text-sm text-red-300" role="alert">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="fb-btn disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-void)] border-t-transparent" />
                Processing…
              </>
            ) : (
              'Pay & unlock discharge'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="fb-btn-ghost disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * On-page Checkout (ui_mode: elements) with Express Checkout (Apple Pay / Google Pay)
 * plus card PaymentElement fallback.
 */
export default function StripePaymentPanel({
  clientSecret,
  publishableKey,
  onPaid,
  onCancel,
  onError,
}) {
  const stripePromise = useMemo(() => {
    if (!publishableKey) return null
    return loadStripe(publishableKey)
  }, [publishableKey])

  if (!clientSecret || !stripePromise) {
    return (
      <p className="text-sm text-amber-200">
        Payment form is not ready. Check that VITE_STRIPE_PUBLISHABLE_KEY is set.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-[#00ffc2] bg-black px-4 py-4">
      <h3 className="text-sm font-semibold text-[#00ffc2]">Pay to unlock discharge</h3>
      <p className="mt-1 text-sm text-gray-400">
        Use Apple Pay or Google Pay when available — your admitted file stays on this
        page.
      </p>
      <div className="mt-4">
        <CheckoutElementsProvider
          stripe={stripePromise}
          options={{
            clientSecret,
            elementsOptions: {
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#00FFC2',
                  borderRadius: '8px',
                },
              },
            },
          }}
        >
          <PaymentForm onPaid={onPaid} onCancel={onCancel} onError={onError} />
        </CheckoutElementsProvider>
      </div>
    </div>
  )
}
