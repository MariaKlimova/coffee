import type { RefObject } from 'react'

import type { CatalogFilterValues } from '../CatalogFilters-Fields'

/** Мобильный диалог редактирования фильтров. */
export interface CatalogFiltersDialogProps {
  /** Ссылка для штатного открытия и закрытия модального диалога. */
  dialogRef: RefObject<HTMLDialogElement | null>
  /** Идентификатор диалога для кнопки открытия. */
  id: string
  /** Черновик, ещё не применённый к каталогу. */
  values: CatalogFilterValues
  /** Изменить черновик. */
  onChange: (patch: Partial<CatalogFilterValues>) => void
  /** Применить все значения одним действием. */
  onApply: () => void
  /** Очистить черновик. */
  onReset: () => void
  /** Диалог закрыт, включая Escape. */
  onClose: () => void
}
