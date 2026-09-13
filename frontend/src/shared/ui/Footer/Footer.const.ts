import { FOOTER_COPY } from '@shared/lib/copy'

import type {
  FooterContactItem,
  FooterLinkItem,
  FooterSocialItem,
} from './Footer.typings'

/** Utility links in the footer. */
export const FOOTER_LINKS: FooterLinkItem[] = [
  { href: '/#delivery', label: FOOTER_COPY.delivery },
  { href: '/#contacts', label: FOOTER_COPY.contacts },
  { href: '/#privacy', label: FOOTER_COPY.privacy },
]

/** Placeholder contact details. */
export const FOOTER_CONTACTS: FooterContactItem[] = [
  { label: FOOTER_COPY.phone, value: '+7 (495) 000-00-00' },
  { label: FOOTER_COPY.email, value: 'hello@coffeeshop.example' },
  { label: FOOTER_COPY.address, value: 'Москва, ул. Примерная, 1' },
]

/** Placeholder social links. */
export const FOOTER_SOCIAL: FooterSocialItem[] = [
  { href: 'https://t.me/', label: 'Telegram' },
  { href: 'https://vk.com/', label: 'VK' },
]
