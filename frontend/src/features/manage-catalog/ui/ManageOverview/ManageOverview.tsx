import { Link } from 'react-router-dom'

import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY, MANAGE_ORDERS_COPY, NAV_COPY } from '@shared/lib/copy'

import styles from './ManageOverview.module.css'

/** Полезный вход владельца: проверка витрины и честный статус будущих инструментов. */
export function ManageOverview() {
  return (
    <section className={styles.ManageOverview}>
      <h1 className={styles['ManageOverview-Title']}>{MANAGE_COPY.homeTitle}</h1>
      <p>{MANAGE_COPY.homeDescription}</p>
      <Link to={APP_ROUTES.manageProducts}>{MANAGE_COPY.productsTitle}</Link>
      <Link to={APP_ROUTES.manageOrders}>{MANAGE_ORDERS_COPY.title}</Link>
      <section className={styles['ManageOverview-Section']}>
        <h2>{MANAGE_COPY.reviewTitle}</h2>
        <p>{MANAGE_COPY.reviewDescription}</p>
        <div className={styles['ManageOverview-Links']}>
          <Link to={APP_ROUTES.coffee}>{NAV_COPY.coffee}</Link>
          <Link to={APP_ROUTES.machines}>{NAV_COPY.machines}</Link>
        </div>
      </section>
      <section className={styles['ManageOverview-Section']}>
        <h2>{MANAGE_COPY.preparingTitle}</h2>
        <p>{MANAGE_COPY.preparingDescription}</p>
      </section>
    </section>
  )
}
