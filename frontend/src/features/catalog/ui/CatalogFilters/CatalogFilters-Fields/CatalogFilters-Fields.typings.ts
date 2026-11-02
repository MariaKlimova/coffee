/** Редактируемые значения цены и наличия. */
export interface CatalogFilterValues {
  /** Нижняя граница цены до нормализации. */
  priceMin: string
  /** Верхняя граница цены до нормализации. */
  priceMax: string
  /** Ограничение по наличию. */
  inStockOnly: boolean
}

/** Поля фильтров с общей разметкой для панели и диалога. */
export interface CatalogFiltersFieldsProps {
  /** Текущие значения полей. */
  values: CatalogFilterValues
  /** Изменить черновик полей. */
  onChange: (patch: Partial<CatalogFilterValues>) => void
  /** Применить одно поле при потере фокуса или Enter в боковой панели. */
  onPriceCommit?: (field: 'priceMin' | 'priceMax') => void
}
