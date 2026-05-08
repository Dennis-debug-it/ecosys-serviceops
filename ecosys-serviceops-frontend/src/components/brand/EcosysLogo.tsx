import { memo } from 'react'
import { appName, brand } from '../../config/brand'

export type EcosysLogoVariant = 'light' | 'dark' | 'icon'
export type EcosysLogoSize = 'sm' | 'md' | 'lg'

type EcosysLogoProps = {
  variant: EcosysLogoVariant
  size: EcosysLogoSize
  className?: string
  subtitle?: string
  title?: string
  subtitleClassName?: string
  imageClassName?: string
}

const sizeMap: Record<EcosysLogoSize, { icon: number; width: number }> = {
  sm: { icon: 20, width: 120 },
  md: { icon: 28, width: 156 },
  lg: { icon: 36, width: 196 },
}

function resolveLogoSource(variant: EcosysLogoVariant) {
  if (variant === 'light') return brand.logoHorizontalLight
  if (variant === 'dark') return brand.logoHorizontalDark
  return brand.logoIcon
}

export const EcosysLogo = memo(function EcosysLogo({
  variant,
  size,
  className = '',
  subtitle = '',
  title = appName,
  subtitleClassName = '',
  imageClassName = '',
}: EcosysLogoProps) {
  const dimensions = sizeMap[size]

  if (variant === 'icon') {
    return (
      <img
        src={resolveLogoSource(variant)}
        alt={title}
        aria-label={title}
        title={title}
        className={`h-auto w-auto shrink-0 ${className}`.trim()}
        height={dimensions.icon}
        width={dimensions.icon}
      />
    )
  }

  return (
    <div className={`flex min-w-0 flex-col items-start gap-2 ${className}`.trim()}>
      <img
        src={resolveLogoSource(variant)}
        alt={title}
        aria-label={title}
        title={title}
        className={`h-auto max-w-full shrink-0 ${imageClassName}`.trim()}
        style={{ width: dimensions.width }}
      />
      {subtitle ? (
        <div className={`truncate text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-muted sm:text-[0.68rem] ${subtitleClassName}`.trim()}>
          {subtitle}
        </div>
      ) : null}
    </div>
  )
})
