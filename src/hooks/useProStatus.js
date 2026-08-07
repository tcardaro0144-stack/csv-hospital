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
  getHealingCreditBalance,
  hasFreemiusUnlock,
  openFreemiusCheckout,
  storeFreemiusPurchase,
  getFreemiusPurchase,
} from '../utils/freemiusCheckout.js'
import { consumeHealingCredit } from '../utils/freemiusCredits.js'

/**
 * Payment-gated unlock via Freemius one-time credits (primary) or Stripe (legacy).
 */
export default function useProStatus() {
  const [isPaid, setIsPaid] = useState(false)
  const [creditBalance, setCreditBalance] = useState(0)
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

  function syncFreemiusCredits(extraMessage) {
    const balance = getHealingCreditBalance()
    setCreditBalance(balance)
    if (balance > 0) {
      setPaymentProvider('freemius')
      setIsPaid(true)
      setCheckoutError(null)
      setCheckoutNotice({
        type: 'success',
        message:
          extraMessage ||
          `One-time credits ready — ${balance} file${balance === 1 ? '' : 's'} remaining.`,
      })
      return true
    }
    setIsPaid(false)
    return false
  }

  useEffect(() => {
    try {
      localStorage.removeItem('csv-hospital-test-mode')
      localStorage.removeItem('table-fixer-test-mode')
    } catch {
      // ignore
    }

    function onFreemiusPurchase(event) {
      const data = event?.detail
      let balance = getHealingCreditBalance()

      // Safety net: Freemius may send null; UpgradeButton still attaches packageId/files.
      if (balance < 1 && (data?.packageId || Number(data?.files) > 0)) {
        storeFreemiusPurchase(data && typeof data === 'object' ? data : {}, {
          packageId: data.packageId,
          files: data.files,
          planId: data.plan_id ?? data.planId,
          pricingId: data.pricing_id ?? data.pricingId,
        })
        balance = getHealingCreditBalance()
      }

      setCreditBalance(balance)
      setPaymentProvider('freemius')
      setIsPaid(balance > 0 || hasFreemiusUnlock())
      setShowPaymentForm(false)
      setClientSecret(null)
      setCheckoutError(null)
      setCheckoutNotice({
        type: 'success',
        message: data?.user?.email
          ? `Freemius one-time purchase confirmed for ${data.user.email} — ${balance} file credit${balance === 1 ? '' : 's'} on hand.`
          : `Freemius one-time purchase confirmed — ${balance} file credit${balance === 1 ? '' : 's'} on hand.`,
      })
    }

    window.addEventListener('freemius:purchaseCompleted', onFreemiusPurchase)

    const params = new URLSearchParams(window.location.search)
    const sessionIdFromReturn = params.get('session_id')

    async function boot() {
      // Clear Stripe/session leftovers; keep stackable Freemius file credits.
      clearProStatus()
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
            // Still restore Freemius credits if present.
            syncFreemiusCredits()
          }
        } catch {
          clearProStatus()
          setIsPaid(false)
          syncFreemiusCredits()
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

      // Restore one-time Freemius credits across reloads.
      // If a prior purchase record exists but the ledger was never written
      // (null Freemius callback), recover credits from that record once.
      if (getHealingCreditBalance() < 1) {
        const prior = getFreemiusPurchase()
        if (
          prior?.unlocked &&
          (prior.packageId || Number(prior.filesGranted) > 0)
        ) {
          storeFreemiusPurchase(prior.raw || prior, {
            packageId: prior.packageId,
            files: prior.filesGranted,
            planId: prior.planId,
            pricingId: prior.pricingId,
          })
        }
      }

      syncFreemiusCredits(
        getHealingCreditBalance() > 0
          ? `Welcome back — ${getHealingCreditBalance()} file credit${getHealingCreditBalance() === 1 ? '' : 's'} remaining.`
          : undefined,
      )
      if (getHealingCreditBalance() < 1) {
        setCheckoutNotice(null)
        setIsPaid(false)
      }
    }

    boot()

    return () => {
      window.removeEventListener('freemius:purchaseCompleted', onFreemiusPurchase)
    }
  }, [])

  /**
   * Primary upgrade path — Freemius one-time package (defaults to 1-file pass).
   */
  async function startCheckout(packageId = 'pass-1') {
    setIsCheckingOut(true)
    setCheckoutError(null)
    setCheckoutNotice(null)

    try {
      await openFreemiusCheckout({
        packageId: typeof packageId === 'string' ? packageId : 'pass-1',
        onPurchaseCompleted: () => {
          syncFreemiusCredits()
        },
        onSuccess: () => {
          syncFreemiusCredits()
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
   * Gate before CSV export — consume one Freemius file credit, or Stripe assert.
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
        setCreditBalance(0)
        setCheckoutError('No file credits left. Purchase another one-time pass.')
        return false
      }

      if (getHealingCreditBalance() > 0) {
        const ok = consumeHealingCredit()
        if (!ok) {
          setIsPaid(false)
          setCreditBalance(0)
          setCheckoutError('No file credits left. Purchase another one-time pass.')
          return false
        }
        const remaining = getHealingCreditBalance()
        setCreditBalance(remaining)
        if (remaining < 1) {
          setIsPaid(false)
        }
        setCheckoutNotice({
          type: 'success',
          message:
            remaining > 0
              ? `Discharged — ${remaining} file credit${remaining === 1 ? '' : 's'} left.`
              : 'Discharged — that was your last file credit.',
        })
        setCheckoutError(null)
        return true
      }

      // Legacy freemius unlock without credit ledger
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
    creditBalance,
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
