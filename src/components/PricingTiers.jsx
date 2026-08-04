import UpgradeButton from './UpgradeButton.jsx'
import {
  HEALING_PASS_PACKAGES,
  formatUsd,
} from '../utils/freemiusPricing.js'

/**
 * Flat one-time Freemius pricing grid — non-recurring file-credit packages.
 * Packages can be combined (credits stack).
 */
export default function PricingTiers({
  isCheckingOut = false,
  creditBalance = 0,
  onAdmit,
}) {
  return (
    <div className="csvh-price-block">
      <div className="csvh-price-intro csvh-price-card">
        <p className="csvh-price-kicker">One-time healing passes</p>
        <h3>Buy file credits. No subscriptions.</h3>
        <p>
          Every package is a <strong>one-time</strong> Freemius purchase — never
          recurring. Credits stack, so buy more than one pack if you need higher
          volume. Triage preview stays free; each discharge uses one credit.
        </p>
        {creditBalance > 0 ? (
          <p className="csvh-credit-balance" role="status">
            Credits on hand: <strong>{creditBalance}</strong> file
            {creditBalance === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      <div className="csvh-price-grid" role="list">
        {HEALING_PASS_PACKAGES.map((pkg) => (
          <article
            key={pkg.id}
            className="csvh-price-tier"
            role="listitem"
            data-package={pkg.id}
          >
            <p className="csvh-price-tier-files">{pkg.label}</p>
            <p className="csvh-price-tier-amount">{formatUsd(pkg.priceUsd)}</p>
            <p className="csvh-price-tier-note">One-time · non-recurring</p>
            <UpgradeButton
              package={pkg}
              className="csvh-cta csvh-price-tier-cta"
              label={`[ BUY ${formatUsd(pkg.priceUsd)} ]`}
              busyLabel="[ OPENING FREEMIUS… ]"
              isLoading={isCheckingOut}
            />
          </article>
        ))}
      </div>

      <div className="csvh-price-admit">
        <button type="button" className="csvh-cta csvh-cta-secondary" onClick={onAdmit}>
          [ ADMIT &amp; HEAL YOUR CSV ]
        </button>
      </div>
    </div>
  )
}
