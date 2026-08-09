import { Button, EmptyState, useToast } from '@shared/ui'

import styles from '../UiKitPage.module.css'

function ToastDemo() {
  const { showToast } = useToast()

  return (
    <div className={styles['UiKitPage-Row']}>
      <Button
        onClick={() => {
          showToast({ message: 'Добавлено в корзину', variant: 'success' })
        }}
      >
        Toast success
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          showToast({ message: 'Добавлено в избранное', variant: 'info' })
        }}
      >
        Toast info
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          showToast({
            message: 'Не удалось добавить в корзину. Попробуй ещё раз',
            variant: 'error',
          })
        }}
      >
        Toast error
      </Button>
    </div>
  )
}

export function UiKitPageFeedbackSection() {
  return (
    <section className={styles['UiKitPage-Section']} id="toast-empty">
      <h2 className={styles['UiKitPage-SectionTitle']}>Toast / Empty</h2>
      <div className={styles['UiKitPage-ComponentBlock']}>
        <h3 className={styles['UiKitPage-SubsectionTitle']}>Toast</h3>
        <ToastDemo />
      </div>
      <div className={styles['UiKitPage-ComponentBlock']}>
        <h3 className={styles['UiKitPage-SubsectionTitle']}>EmptyState</h3>
        <EmptyState
          title="Корзина пока пуста"
          description="Добавь кофе или кофемашину из каталога"
          action={<Button>В каталог</Button>}
        />
      </div>
    </section>
  )
}
