import { Link } from 'react-router-dom'

import type { ManagePlaceholderProps } from './ManagePlaceholder.typings'
import styles from './ManagePlaceholder.module.css'

/** Заглушка не имитирует сохранение до подключения работы с товарами. */
export function ManagePlaceholder({
  title,
  description,
  to,
  linkLabel,
}: ManagePlaceholderProps) {
  return (
    <section className={styles.ManagePlaceholder}>
      <h1 className={styles['ManagePlaceholder-Title']}>{title}</h1>
      <p className={styles['ManagePlaceholder-Description']}>{description}</p>
      <Link className={styles['ManagePlaceholder-Link']} to={to}>
        {linkLabel}
      </Link>
    </section>
  )
}
