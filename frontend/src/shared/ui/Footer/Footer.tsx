import { Link } from 'react-router-dom'

import { cx } from '@shared/lib/cx'

import { FOOTER_CONTACTS, FOOTER_LINKS, FOOTER_SOCIAL } from './Footer.const'
import type { FooterProps } from './Footer.typings'
import styles from './Footer.module.css'

export function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className={cx(styles.Footer, className)}>
      <div className={styles['Footer-Inner']}>
        <div className={styles['Footer-Column']}>
          <p className={styles['Footer-Brand']}>Coffee Shop</p>
          <p className={styles['Footer-Copy']}>
            © {year} Coffee Shop. Свежая обжарка для твоего утра.
          </p>
        </div>

        <nav className={styles['Footer-Column']} aria-label="Полезные ссылки">
          <p className={styles['Footer-Title']}>Информация</p>
          <ul className={styles['Footer-List']}>
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link to={item.href} className={styles['Footer-Link']}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles['Footer-Column']}>
          <p className={styles['Footer-Title']}>Контакты</p>
          <ul className={styles['Footer-List']}>
            {FOOTER_CONTACTS.map((item) => (
              <li key={item.label} className={styles['Footer-Contact']}>
                <span className={styles['Footer-ContactLabel']}>{item.label}</span>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles['Footer-Column']}>
          <p className={styles['Footer-Title']}>Мы рядом</p>
          <ul className={styles['Footer-Social']}>
            {FOOTER_SOCIAL.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className={styles['Footer-SocialLink']}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
