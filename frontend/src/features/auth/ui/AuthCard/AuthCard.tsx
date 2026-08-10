import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { cx } from '@shared/lib/cx'

import type { AuthCardProps } from './AuthCard.typings'
import styles from './AuthCard.module.css'

export function AuthCard({
  title,
  formError,
  children,
  footerPrompt,
  footerLinkLabel,
  footerTo,
  className,
}: AuthCardProps) {
  const formErrorRef = useRef<HTMLParagraphElement>(null)
  const footer =
    footerPrompt && footerLinkLabel && footerTo
      ? { prompt: footerPrompt, label: footerLinkLabel, to: footerTo }
      : null

  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus()
    }
  }, [formError])

  return (
    <section className={cx(styles.AuthCard, className)}>
      <h1 className={styles['AuthCard-Title']}>{title}</h1>
      {formError ? (
        <p
          ref={formErrorRef}
          className={styles['AuthCard-FormError']}
          role="alert"
          tabIndex={-1}
        >
          {formError}
        </p>
      ) : null}
      <div className={styles['AuthCard-Body']}>{children}</div>
      {footer ? (
        <p className={styles['AuthCard-Footer']}>
          <span>{footer.prompt}</span>
          <Link to={footer.to} className={styles['AuthCard-FooterLink']}>
            {footer.label}
          </Link>
        </p>
      ) : null}
    </section>
  )
}
