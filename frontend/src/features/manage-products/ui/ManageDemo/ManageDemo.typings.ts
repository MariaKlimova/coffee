import type { CatalogState } from '../../api/manageCatalogApi'

export interface ManageDemoProps {
  /** Сохранённое серверное состояние каталога. */
  catalog: CatalogState
  /** Подтверждённый переход на свой каталог. */
  onDisable: () => Promise<unknown>
}
