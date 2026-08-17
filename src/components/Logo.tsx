/**
 * IPG-CRM mark: three ascending bars (a pipeline advancing) inside a rounded
 * tile. Uses currentColor-independent gradient stops so it reads on any
 * background, light or dark.
 */
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ipg-mark" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#ipg-mark)" />
      <rect x="10" y="21" width="4.5" height="9" rx="2.25" fill="white" fillOpacity="0.65" />
      <rect x="17.75" y="16" width="4.5" height="14" rx="2.25" fill="white" fillOpacity="0.85" />
      <rect x="25.5" y="10" width="4.5" height="20" rx="2.25" fill="white" />
    </svg>
  )
}

export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className="text-ink text-[15px] font-semibold tracking-tight">
        IPG<span className="text-subtle mx-px">-</span>CRM
      </span>
    </span>
  )
}
