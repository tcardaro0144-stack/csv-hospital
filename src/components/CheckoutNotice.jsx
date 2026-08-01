export default function CheckoutNotice({ notice, onDismiss }) {
  if (!notice) return null

  const isSuccess = notice.type === 'success'
  const styles = isSuccess
    ? 'border-[#00ffc2] bg-black text-[#00ffc2]'
    : 'border-gray-600 bg-black text-gray-300'

  return (
    <div
      role="status"
      className={`mt-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <p>{notice.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs font-medium uppercase tracking-wide opacity-70 hover:opacity-100"
        aria-label="Dismiss notice"
      >
        Dismiss
      </button>
    </div>
  )
}
