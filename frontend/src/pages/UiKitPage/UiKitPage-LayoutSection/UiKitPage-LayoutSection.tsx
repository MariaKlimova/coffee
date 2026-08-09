import { useState } from 'react'

import { Button } from '@shared/ui/Button'
import { Footer } from '@shared/ui/Footer'
import { Header } from '@shared/ui/Header'

import styles from '../UiKitPage.module.css'

export function UiKitPageLayoutSection() {
  const [userMode, setUserMode] = useState<'guest' | 'user'>('guest')

  return (
    <section className={styles['UiKitPage-Section']} id="layout">
      <h2 className={styles['UiKitPage-SectionTitle']}>Layout</h2>

      <div className={styles['UiKitPage-ComponentBlock']}>
        <h3 className={styles['UiKitPage-SubsectionTitle']}>Header</h3>
        <div className={styles['UiKitPage-Row']}>
          <Button
            size="sm"
            variant={userMode === 'guest' ? 'primary' : 'secondary'}
            onClick={() => {
              setUserMode('guest')
            }}
          >
            Гость
          </Button>
          <Button
            size="sm"
            variant={userMode === 'user' ? 'primary' : 'secondary'}
            onClick={() => {
              setUserMode('user')
            }}
          >
            Авторизован
          </Button>
        </div>
        <div className={styles['UiKitPage-LayoutDemo']}>
          <Header
            favoritesCount={0}
            cartCount={9}
            user={userMode === 'user' ? { name: 'Маша' } : null}
            onSearchSubmit={() => undefined}
            onLogout={() => {
              setUserMode('guest')
            }}
          />
          <Header
            favoritesCount={3}
            cartCount={150}
            user={{ name: 'Маша' }}
            onSearchSubmit={() => undefined}
          />
        </div>
      </div>

      <div className={styles['UiKitPage-ComponentBlock']}>
        <h3 className={styles['UiKitPage-SubsectionTitle']}>Footer</h3>
        <div className={styles['UiKitPage-LayoutDemo']}>
          <Footer />
        </div>
      </div>
    </section>
  )
}
