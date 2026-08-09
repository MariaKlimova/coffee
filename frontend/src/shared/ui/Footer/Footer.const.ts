import type {
  FooterContactItem,
  FooterLinkItem,
  FooterSocialItem,
} from './Footer.typings'

/** Utility links in the footer. */
export const FOOTER_LINKS: FooterLinkItem[] = [
  { href: '/#delivery', label: 'Доставка и оплата' },
  { href: '/#contacts', label: 'Контакты' },
  { href: '/#privacy', label: 'Политика конфиденциальности' },
]

/** Placeholder contact details. */
export const FOOTER_CONTACTS: FooterContactItem[] = [
  { label: 'Телефон', value: '+7 (495) 000-00-00' },
  { label: 'Email', value: 'hello@coffeeshop.example' },
  { label: 'Адрес', value: 'Москва, ул. Примерная, 1' },
]

/** Placeholder social links. */
export const FOOTER_SOCIAL: FooterSocialItem[] = [
  { href: 'https://t.me/', label: 'Telegram' },
  { href: 'https://vk.com/', label: 'VK' },
]
