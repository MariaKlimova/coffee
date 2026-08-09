/**
 * Footer text link.
 */
export interface FooterLinkItem {
  /** Destination href (path or hash). */
  href: string
  /** Visible label. */
  label: string
}

/**
 * Footer contact line.
 */
export interface FooterContactItem {
  /** Contact label (Телефон, Email, Адрес). */
  label: string
  /** Contact value. */
  value: string
}

/**
 * Footer social icon link.
 */
export interface FooterSocialItem {
  /** Destination href. */
  href: string
  /** Accessible name. */
  label: string
}

/**
 * Props for the store footer.
 */
export interface FooterProps {
  /** Optional extra class name. */
  className?: string
}
