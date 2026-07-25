import { Badge, Button, Checkbox, Input, Radio, Select } from '@shared/ui'

import {
  COLOR_SWATCHES,
  RADIUS_SAMPLES,
  SELECT_DEMO_OPTIONS,
  SPACE_SAMPLES,
  UI_KIT_NAV,
} from './UiKitPage.const'
import styles from './UiKitPage.module.css'

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M16.5 16.5 21 21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UiKitPage() {
  return (
    <main className={styles.UiKitPage}>
      <h1 className={styles['UiKitPage-Title']}>Дизайн-система</h1>
      <p className={styles['UiKitPage-Lead']}>
        Витрина токенов и базовых UI-компонентов. Здесь можно проверить цвета,
        типографику, шкалы и состояния элементов.
      </p>

      <nav aria-label="Разделы витрины">
        <ul className={styles['UiKitPage-Nav']}>
          {UI_KIT_NAV.map((item) => (
            <li key={item.href}>
              <a className={styles['UiKitPage-NavLink']} href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className={styles['UiKitPage-Section']} id="colors">
        <h2 className={styles['UiKitPage-SectionTitle']}>Colors</h2>
        <div className={styles['UiKitPage-Grid']}>
          {COLOR_SWATCHES.map((swatch) => (
            <article key={swatch.token} className={styles['UiKitPage-Swatch']}>
              <div
                className={styles['UiKitPage-SwatchChip']}
                style={{ background: `var(${swatch.token})` }}
              />
              <p className={styles['UiKitPage-Meta']}>
                <span className={styles['UiKitPage-MetaStrong']}>{swatch.token}</span>
                {swatch.value} — {swatch.role}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles['UiKitPage-Section']} id="typography">
        <h2 className={styles['UiKitPage-SectionTitle']}>Typography</h2>

        <h3 className={styles['UiKitPage-SubsectionTitle']}>Семейства</h3>
        <div className={styles['UiKitPage-Stack']}>
          <div>
            <p className={styles['UiKitPage-Sample--display']}>
              Свежая обжарка для твоего утра
            </p>
            <p className={styles['UiKitPage-Meta']}>
              --font-display · Lora · --text-xl · --weight-semibold
            </p>
          </div>
          <div>
            <p className={styles['UiKitPage-Sample--md']}>
              Выбери кофе или кофемашину — каталог рядом.
            </p>
            <p className={styles['UiKitPage-Meta']}>
              --font-sans · --text-md · --weight-regular
            </p>
          </div>
        </div>

        <h3 className={styles['UiKitPage-SubsectionTitle']}>Размеры</h3>
        <div className={styles['UiKitPage-Stack']}>
          <div>
            <p className={styles['UiKitPage-Sample--display']}>Заголовок страницы</p>
            <p className={styles['UiKitPage-Meta']}>--text-xl (2rem)</p>
          </div>
          <div>
            <p className={styles['UiKitPage-Sample--lg']}>Подзаголовок секции</p>
            <p className={styles['UiKitPage-Meta']}>--text-lg (1.25rem)</p>
          </div>
          <div>
            <p className={styles['UiKitPage-Sample--md']}>Основной текст карточки</p>
            <p className={styles['UiKitPage-Meta']}>--text-md (1rem)</p>
          </div>
          <div>
            <p className={styles['UiKitPage-Sample--sm']}>Название товара</p>
            <p className={styles['UiKitPage-Meta']}>--text-sm (0.875rem)</p>
          </div>
          <div>
            <p className={styles['UiKitPage-Sample--caption']}>Подпись и мета</p>
            <p className={styles['UiKitPage-Meta']}>--text-caption (0.75rem)</p>
          </div>
        </div>

        <h3 className={styles['UiKitPage-SubsectionTitle']}>Веса</h3>
        <div className={styles['UiKitPage-Stack']}>
          <p
            className={`${styles['UiKitPage-Sample--md']} ${styles['UiKitPage-Sample--weightRegular']}`}
          >
            Regular — спокойный основной текст
          </p>
          <p className={styles['UiKitPage-Meta']}>--weight-regular</p>
          <p
            className={`${styles['UiKitPage-Sample--md']} ${styles['UiKitPage-Sample--weightMedium']}`}
          >
            Medium — акценты в интерфейсе
          </p>
          <p className={styles['UiKitPage-Meta']}>--weight-medium</p>
          <p
            className={`${styles['UiKitPage-Sample--md']} ${styles['UiKitPage-Sample--weightSemibold']}`}
          >
            Semibold — заголовки и цены
          </p>
          <p className={styles['UiKitPage-Meta']}>--weight-semibold</p>
        </div>

        <h3 className={styles['UiKitPage-SubsectionTitle']}>Leading</h3>
        <div className={styles['UiKitPage-Stack']}>
          <div>
            <p
              className={`${styles['UiKitPage-Sample--md']} ${styles['UiKitPage-Sample--leadingTight']}`}
            >
              Плотный интерлиньяж подходит для коротких заголовков и названий в карточке
              товара.
            </p>
            <p className={styles['UiKitPage-Meta']}>--leading-tight</p>
          </div>
          <div>
            <p
              className={`${styles['UiKitPage-Sample--md']} ${styles['UiKitPage-Sample--leadingNormal']}`}
            >
              Обычный интерлиньяж читается спокойнее в описаниях, подсказках и длинных
              абзацах на страницах каталога.
            </p>
            <p className={styles['UiKitPage-Meta']}>--leading-normal</p>
          </div>
        </div>
      </section>

      <section className={styles['UiKitPage-Section']} id="spacing">
        <h2 className={styles['UiKitPage-SectionTitle']}>Spacing</h2>
        <div className={styles['UiKitPage-Stack']}>
          {SPACE_SAMPLES.map((sample) => (
            <div key={sample.token} className={styles['UiKitPage-SpaceItem']}>
              <div
                className={styles['UiKitPage-SpaceBar']}
                style={{ width: `var(${sample.token})` }}
              />
              <p className={styles['UiKitPage-Meta']}>
                <span className={styles['UiKitPage-MetaStrong']}>{sample.token}</span>
                {sample.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles['UiKitPage-Section']} id="radius">
        <h2 className={styles['UiKitPage-SectionTitle']}>Radius</h2>
        <div className={styles['UiKitPage-RadiusGrid']}>
          {RADIUS_SAMPLES.map((sample) => (
            <div
              key={sample.token}
              className={styles['UiKitPage-RadiusCard']}
              style={{ borderRadius: `var(${sample.token})` }}
            >
              <p className={styles['UiKitPage-Meta']}>
                <span className={styles['UiKitPage-MetaStrong']}>{sample.token}</span>
                {sample.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles['UiKitPage-Section']} id="shadow">
        <h2 className={styles['UiKitPage-SectionTitle']}>Shadow</h2>
        <div className={styles['UiKitPage-Row']}>
          <div
            className={`${styles['UiKitPage-ShadowCard']} ${styles['UiKitPage-ShadowCard--sm']}`}
          >
            <p className={styles['UiKitPage-MetaStrong']}>--shadow-sm</p>
            <p className={styles['UiKitPage-Meta']}>Лёгкая тень карточки и header</p>
          </div>
          <div
            className={`${styles['UiKitPage-ShadowCard']} ${styles['UiKitPage-ShadowCard--md']}`}
          >
            <p className={styles['UiKitPage-MetaStrong']}>--shadow-md</p>
            <p className={styles['UiKitPage-Meta']}>Hover и поднятие блока</p>
          </div>
        </div>
      </section>

      <section className={styles['UiKitPage-Section']} id="grid">
        <h2 className={styles['UiKitPage-SectionTitle']}>Grid</h2>
        <p className={styles['UiKitPage-Meta']}>
          Контейнер --layout-max-width, боковые отступы --layout-gutter, зазор колонок
          --layout-columns-gap
        </p>
        <div className={styles['UiKitPage-GridDemoOuter']}>
          <div className={styles['UiKitPage-GridDemoInner']}>
            <div className={styles['UiKitPage-GridDemoCell']}>Колонка 1</div>
            <div className={styles['UiKitPage-GridDemoCell']}>Колонка 2</div>
            <div className={styles['UiKitPage-GridDemoCell']}>Колонка 3</div>
          </div>
        </div>
      </section>

      <section className={styles['UiKitPage-Section']} id="components">
        <h2 className={styles['UiKitPage-SectionTitle']}>Components</h2>

        <div className={styles['UiKitPage-ComponentBlock']}>
          <h3 className={styles['UiKitPage-SubsectionTitle']}>Button</h3>
          <p className={styles['UiKitPage-Meta']}>Variants</p>
          <div className={styles['UiKitPage-Row']}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <p className={styles['UiKitPage-Meta']}>Sizes</p>
          <div className={styles['UiKitPage-Row']}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
          <p className={styles['UiKitPage-Meta']}>States and icons</p>
          <div className={styles['UiKitPage-Row']}>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button iconLeft={<SearchIcon />}>С иконкой</Button>
            <Button variant="secondary" iconRight={<ArrowIcon />}>
              Дальше
            </Button>
          </div>
        </div>

        <div className={styles['UiKitPage-ComponentBlock']}>
          <h3 className={styles['UiKitPage-SubsectionTitle']}>Input</h3>
          <div className={styles['UiKitPage-FieldStack']}>
            <Input label="Имя" placeholder="Как к тебе обращаться" />
            <Input
              label="Поиск"
              placeholder="Найди кофе"
              icon={<SearchIcon />}
              helperText="Можно искать по названию"
            />
            <Input label="Email" defaultValue="bad@" errorText="Проверь адрес почты" />
            <Input label="Город" defaultValue="Москва" disabled />
          </div>
        </div>

        <div className={styles['UiKitPage-ComponentBlock']}>
          <h3 className={styles['UiKitPage-SubsectionTitle']}>Select</h3>
          <div className={styles['UiKitPage-FieldStack']}>
            <Select
              label="Сортировка"
              options={SELECT_DEMO_OPTIONS}
              defaultValue="name"
            />
            <Select
              label="Категория"
              options={SELECT_DEMO_OPTIONS}
              placeholder="Выбери вариант"
            />
            <Select
              label="Фильтр"
              options={SELECT_DEMO_OPTIONS}
              defaultValue="name"
              errorText="Выбери значение из списка"
            />
            <Select
              label="Недоступно"
              options={SELECT_DEMO_OPTIONS}
              defaultValue="name"
              disabled
            />
          </div>
        </div>

        <div className={styles['UiKitPage-ComponentBlock']}>
          <h3 className={styles['UiKitPage-SubsectionTitle']}>Checkbox</h3>
          <div className={styles['UiKitPage-Stack']}>
            <Checkbox label="Получать новости о свежей обжарке" />
            <Checkbox label="Согласен с условиями" defaultChecked />
            <Checkbox label="Недоступный пункт" disabled />
            <Checkbox label="Нужно подтверждение" error />
          </div>
        </div>

        <div className={styles['UiKitPage-ComponentBlock']}>
          <h3 className={styles['UiKitPage-SubsectionTitle']}>Radio</h3>
          <div className={styles['UiKitPage-RadioGroup']}>
            <Radio name="grind" value="whole" label="В зёрнах" defaultChecked />
            <Radio name="grind" value="ground" label="Молотый" />
            <Radio name="grind" value="capsules" label="Капсулы" disabled />
          </div>
        </div>

        <div className={styles['UiKitPage-ComponentBlock']}>
          <h3 className={styles['UiKitPage-SubsectionTitle']}>Badge</h3>
          <div className={styles['UiKitPage-Row']}>
            <Badge variant="neutral">Нет в наличии</Badge>
            <Badge variant="success">Новинка</Badge>
            <Badge variant="danger">Ошибка оплаты</Badge>
          </div>
        </div>
      </section>
    </main>
  )
}
