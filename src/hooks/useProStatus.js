import { useEffect, useState } from 'react'
import {
  assertDownloadAllowed,
  clearProStatus,
  confirmCheckoutSession,
  createPaymentIntent,
  getPaidSessionId,
  storePaidSessionId,
} from '../utils/proAccess.js'
import {
  hasFreemiusUnlock,
  openFreemiusCheckout,
  storeFreemiusPurchase,
} from '../utils/freemiusCheckout.js'

/**
 * Payment-gated unlock via Freemius overlay (primary) or Stripe session (legacy).
 */
export default function useProStatus() {
  const [isPaid, setIsPaid] = useState(false)
  const [paidSessionId, setPaidSessionId] = useState(null)
  const [paymentProvider, setPaymentProvider] = useState(null) // 'freemius' | 'stripe'
  const [isVerifying, setIsVerifying] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [checkoutSessionId, setCheckoutSessionId] = useState(null)
  const [publishableKey, setPublishableKey] = useState(
    () => import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  )
  const [checkoutError, setCheckoutError] = useState(null)
  const [checkoutNotice, setCheckoutNotice] = useState(null)

  useEffect(() => {
    try {
      localStorage.removeItem('csv-hospital-test-mode')
      localStorage.removeItem('table-fixer-test-mode')
    } catch {
      // ignore
    }

    function onFreemiusPurchase(event) {
      const data = event?.detail
      if (data) {
        storeFreemiusPurchase(data)
      }
      applyFreemiusUnlock(data)
    }

    window.addEventListener('freemius:purchaseCompleted', onFreemiusPurchase)

    const params = new URLSearchParams(window.location.search)
    const sessionIdFromReturn = params.get('session_id')

    async function boot() {
      // Fresh hospital load: start locked (no stale "Cleared" from prior local unlocks).
      // Stripe return_url with session_id still verifies below.
      clearProStatus()
      setIsPaid(false)
      setPaidSessionId(null)
      setPaymentProvider(null)

      if (sessionIdFromReturn) {
        setIsVerifying(true)
        try {
          const paid = await confirmCheckoutSession(sessionIdFromReturn)
          if (paid) {
            storePaidSessionId(sessionIdFromReturn)
            setPaidSessionId(sessionIdFromReturn)
            setPaymentProvider('stripe')
            setIsPaid(true)
            setCheckoutNotice({
              type: 'success',
              message: 'Payment confirmed — your file is ready to download.',
            })
          } else {
            clearProStatus()
            setIsPaid(false)
            setCheckoutError('Payment was not completed. Download stays locked.')
          }
        } catch {
          clearProStatus()
          setIsPaid(false)
        } finally {
          setIsVerifying(false)
        }

        params.delete('session_id')
        const nextQuery = params.toString()
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`,
        )
        return
      }

      setIsPaid(false)
    }

    boot()

    return () => {
      window.removeEventListener('freemius:purchaseCompleted', onFreemiusPurchase)
    }
    // applyFreemiusUnlock is stable enough for this mount-only effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFreemiusUnlock(data) {
    setPaymentProvider('freemius')
    setIsPaid(true)
    setShowPaymentForm(false)
    setClientSecret(null)
    setCheckoutError(null)
    setCheckoutNotice({
      type: 'success',
      message: data?.user?.email
        ? `Freemius purchase confirmed for ${data.user.email} — download unlocked.`
        : 'Freemius purchase confirmed — download unlocked.',
    })
  }

  /**
   * Primary upgrade path — Freemius modal dialog checkout.
   */
  async function startCheckout() {
    setIsCheckingOut(true)
    setCheckoutError(null)
    setCheckoutNotice(null)

    try {
      await openFreemiusCheckout({
        onPurchaseCompleted: (data) => {
          applyFreemiusUnlock(data)
        },
        onSuccess: (data) => {
          applyFreemiusUnlock(data)
        },
        onError: (error) => {
          setCheckoutError(error.message || 'Unable to open Freemius checkout.')
        },
      })
    } catch (error) {
      setCheckoutError(error.message || 'Unable to open Freemius checkout.')
    } finally {
      setIsCheckingOut(false)
    }
  }

  /** Optional Stripe Elements path (kept for return_url / legacy sessions). */
  async function startStripeCheckout() {
    setIsCheckingOut(true)
    setCheckoutError(null)
    setCheckoutNotice(null)

    try {
      const data = await createPaymentIntent()
      setClientSecret(data.clientSecret)
      setCheckoutSessionId(data.sessionId || null)
      if (data.publishableKey) {
        setPublishableKey(data.publishableKey)
      } else if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
        throw new Error(
          'Missing Stripe publishable key. Set VITE_STRIPE_PUBLISHABLE_KEY in .env',
        )
      }
      setShowPaymentForm(true)
    } catch (error) {
      setCheckoutError(error.message || 'Unable to start payment.')
      setShowPaymentForm(false)
    } finally {
      setIsCheckingOut(false)
    }
  }

  function cancelPayment() {
    setShowPaymentForm(false)
    setClientSecret(null)
    setCheckoutSessionId(null)
  }

  async function handlePaymentSuccess(sessionId) {
    setIsVerifying(true)
    setCheckoutError(null)
    const id = sessionId || checkoutSessionId

    try {
      if (!id) {
        throw new Error('Missing checkout session id.')
      }

      const paid = await confirmCheckoutSession(id)
      if (!paid) {
        clearProStatus()
        setIsPaid(false)
        setPaidSessionId(null)
        setCheckoutError('Stripe did not confirm payment. Download stays locked.')
        return
      }

      const allowed = await assertDownloadAllowed(id)
      if (!allowed) {
        clearProStatus()
        setIsPaid(false)
        setCheckoutError('Payment could not be verified for download.')
        return
      }

      storePaidSessionId(id)
      setPaidSessionId(id)
      setPaymentProvider('stripe')
      setIsPaid(true)
      setShowPaymentForm(false)
      setClientSecret(null)
      setCheckoutNotice({
        type: 'success',
        message: 'Payment confirmed — your file is ready to download.',
      })
    } catch (error) {
      clearProStatus()
      setIsPaid(false)
      setCheckoutError(error.message || 'Unable to verify payment.')
    } finally {
      setIsVerifying(false)
    }
  }

  /**
   * Gate before CSV export — Freemius local purchase or Stripe server assert.
   */
  async function confirmUnlock() {
    if (!isPaid) {
      setCheckoutNotice({
        type: 'cancelled',
        message: 'Payment required before download.',
      })
      return false
    }

    if (paymentProvider === 'freemius' || hasFreemiusUnlock()) {
      if (!hasFreemiusUnlock()) {
        setIsPaid(false)
        setCheckoutError('Freemius purchase not found. Please complete checkout again.')
        return false
      }
      setCheckoutError(null)
      return true
    }

    const sessionId = paidSessionId || getPaidSessionId()
    if (!sessionId) {
      setIsPaid(false)
      setCheckoutError('No paid session on file. Please complete payment again.')
      return false
    }

    try {
      const allowed = await assertDownloadAllowed(sessionId)
      if (!allowed) {
        clearProStatus()
        setIsPaid(false)
        setPaidSessionId(null)
        setCheckoutError('Payment is no longer valid. Download blocked.')
        return false
      }
      setCheckoutError(null)
      return true
    } catch {
      setCheckoutError('Unable to verify payment before download.')
      return false
    }
  }

  function dismissNotice() {
    setCheckoutNotice(null)
  }

  return {
    isPaid,
    isPro: isPaid,
    paymentProvider,
    isVerifying,
    isCheckingOut,
    showPaymentForm,
    clientSecret,
    publishableKey,
    checkoutError,
    checkoutNotice,
    dismissNotice,
    startCheckout,
    startStripeCheckout,
    cancelPayment,
    handlePaymentSuccess,
    confirmUnlock,
  }
}
