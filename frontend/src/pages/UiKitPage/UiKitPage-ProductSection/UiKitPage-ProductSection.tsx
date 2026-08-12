import { useState } from 'react'

import {
  Button,
  ExpandedProductCard,
  ProductCard,
  ProductCardSkeleton,
} from '@shared/ui'

import { DEMO_COFFEE_IMAGES, DEMO_MACHINE_IMAGES } from '../UiKitPage.const'
import styles from '../UiKitPage.module.css'

export function UiKitPageProductSection() {
  const [favorite, setFavorite] = useState(false)
  const [expanded, setExpanded] = useState<'coffee' | 'machines' | null>('coffee')

  return (
    <section className={styles['UiKitPage-Section']} id="product-cards">
      <h2 className={styles['UiKitPage-SectionTitle']}>Product cards</h2>
      <div className={styles['UiKitPage-ProductGrid']}>
        <ProductCard
          id="coffee-1"
          categoryLabel="Кофе"
          title="Эфиопия Иргачеффе"
          description="Цветочный аромат и мягкая кислотность для спокойного утра"
          images={DEMO_COFFEE_IMAGES}
          price="1 290 ₽"
          oldPrice="1 490 ₽"
          isFavorite={favorite}
          onToggleFavorite={() => {
            setFavorite((value) => !value)
          }}
          onAddToCart={() => undefined}
          onExpand={() => {
            setExpanded('coffee')
          }}
        />
        <ProductCard
          id="coffee-oos"
          categoryLabel="Кофе"
          title="Бразилия Сантос"
          description="Пока нет в наличии — загляни позже"
          images={DEMO_COFFEE_IMAGES.slice(0, 1)}
          price="990 ₽"
          inStock={false}
          onExpand={() => undefined}
        />
        <ProductCardSkeleton />
      </div>

      <h3 className={styles['UiKitPage-SubsectionTitle']}>ExpandedProductCard</h3>
      <div className={styles['UiKitPage-Row']}>
        <Button
          variant={expanded === 'coffee' ? 'primary' : 'secondary'}
          onClick={() => {
            setExpanded('coffee')
          }}
        >
          Показать кофе
        </Button>
        <Button
          variant={expanded === 'machines' ? 'primary' : 'secondary'}
          onClick={() => {
            setExpanded('machines')
          }}
        >
          Показать кофемашину
        </Button>
      </div>
      <div className={styles['UiKitPage-ExpandedDemo']}>
        {expanded === 'coffee' ? (
          <ExpandedProductCard
            id="coffee-1"
            category="coffee"
            categoryLabel="Кофе"
            title="Эфиопия Иргачеффе"
            description="Светлая обжарка с нотами жасмина и цитруса. Подходит для фильтра и альтернативы."
            images={DEMO_COFFEE_IMAGES}
            price="1 290 ₽"
            oldPrice="1 490 ₽"
            attributes={{
              originCountry: 'Эфиопия',
              intensity: 8,
              bitterness: 2,
              acidity: 4,
              roast: 2,
              density: 3,
            }}
            onClose={() => {
              setExpanded(null)
            }}
            isFavorite={favorite}
            onToggleFavorite={() => {
              setFavorite((value) => !value)
            }}
            similarSlot={
              <p className={styles['UiKitPage-Meta']}>Место для похожих товаров</p>
            }
          />
        ) : null}
        {expanded === 'machines' ? (
          <ExpandedProductCard
            id="machine-1"
            category="machines"
            categoryLabel="Кофемашины"
            title="Essenza Mini"
            description="Компактная капсульная машина для небольшой кухни."
            images={DEMO_MACHINE_IMAGES}
            price="8 990 ₽"
            attributes={{
              dimensions: '11 × 32.5 × 20.5 см',
              pressureBar: '19 бар',
              powerW: '1310 Вт',
              capsuleFormat: 'Nespresso',
              manufacturerCountry: 'Швейцария',
            }}
            onClose={() => {
              setExpanded(null)
            }}
            isFavorite={favorite}
            onToggleFavorite={() => {
              setFavorite((value) => !value)
            }}
          />
        ) : null}
      </div>
    </section>
  )
}
