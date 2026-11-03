import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATEGORY_LABELS, type ProductCategorySlug } from '@entities/product'
import { APP_ROUTES } from '@shared/config'
import { MANAGE_COPY, PRODUCT_FORM_COPY as COPY } from '@shared/lib/copy'
import { Button } from '@shared/ui/Button'
import { Input } from '@shared/ui/Input'
import { Select } from '@shared/ui/Select'
import { Textarea } from '@shared/ui/Textarea'
import { useToast } from '@shared/ui/Toast'
import {
  ATTRIBUTE_FIELDS,
  attributeMax,
  formPayload,
  initialForm,
  isNumericAttribute,
  mapFormError,
  validateForm,
  type FormErrors,
} from '../../../lib/productForm'
import type { ManageProductFieldsProps } from '../ManageProductForm.typings'
import styles from '../ManageProductForm.module.css'

export function ManageProductFields({ product, onSave }: ManageProductFieldsProps) {
  const [values, setValues] = useState(() => initialForm(product))
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState('')
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [nextCategory, setNextCategory] = useState<ProductCategorySlug | null>(null)
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const submitting = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const demo = product?.origin === 'demo'
  function change(field: keyof typeof values, value: string | boolean) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
    setFormError('')
  }
  function focusError() {
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    )
  }
  return (
    <form
      ref={form}
      noValidate
      className={styles['ManageProductForm-Fields']}
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitting.current || nextCategory) return
        const validation = validateForm(values, demo, consent)
        setErrors(validation)
        setFormError('')
        if (Object.keys(validation).length) {
          setFormError(COPY.validationError)
          focusError()
          return
        }
        submitting.current = true
        setPending(true)
        try {
          const saved = await onSave(formPayload(values, demo))
          if (!active.current) return
          showToast({
            message: product ? MANAGE_COPY.saved : COPY.created,
            variant: 'success',
          })
          navigate(
            APP_ROUTES.manageProductEdit.replace(':id', encodeURIComponent(saved.id)),
            { replace: true },
          )
        } catch (error) {
          if (!active.current) return
          const fields = mapFormError(error)
          setErrors(fields)
          setFormError(
            Object.keys(fields).length ? COPY.validationError : MANAGE_COPY.saveError,
          )
          focusError()
        } finally {
          submitting.current = false
          if (active.current) setPending(false)
        }
      }}
    >
      <fieldset disabled={pending} className={styles['ManageProductForm-Section']}>
        <legend>{COPY.general}</legend>
        <Input
          label={COPY.name}
          value={values.name}
          onChange={(event) => change('name', event.target.value)}
          errorText={errors.name}
          required
        />
        <Select
          label={MANAGE_COPY.category}
          value={values.category}
          options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
          errorText={errors.category}
          onChange={(event) => {
            const category = event.target.value as ProductCategorySlug
            if (category !== values.category) setNextCategory(category)
          }}
        />
        {nextCategory && (
          <div
            className={styles['ManageProductForm-Notice']}
            role="region"
            aria-label={COPY.changeCategory}
          >
            <h2>{COPY.changeCategory}</h2>
            <p>{COPY.categoryWarning}</p>
            <div className={styles['ManageProductForm-Actions']}>
              <Button
                onClick={() => {
                  setValues((previous) => ({
                    ...previous,
                    category: nextCategory,
                    attributes: {},
                  }))
                  setErrors({})
                  setNextCategory(null)
                }}
              >
                {COPY.confirmCategory}
              </Button>
              <Button variant="ghost" onClick={() => setNextCategory(null)}>
                {MANAGE_COPY.cancel}
              </Button>
            </div>
          </div>
        )}
        <Textarea
          label={COPY.shortDescription}
          rows={3}
          value={values.short_description}
          onChange={(event) => change('short_description', event.target.value)}
          errorText={errors.short_description}
          required
        />
        <Textarea
          label={COPY.description}
          rows={6}
          value={values.description}
          onChange={(event) => change('description', event.target.value)}
          errorText={errors.description}
        />
        <div className={styles['ManageProductForm-Grid']}>
          <Input
            label={COPY.price}
            inputMode="decimal"
            value={values.price}
            onChange={(event) => change('price', event.target.value)}
            errorText={errors.price}
            required
          />
          <Input
            label={COPY.oldPrice}
            inputMode="decimal"
            value={values.old_price}
            onChange={(event) => change('old_price', event.target.value)}
            helperText={COPY.oldPriceHint}
            errorText={errors.old_price}
          />
        </div>
      </fieldset>
      <fieldset disabled={pending} className={styles['ManageProductForm-Section']}>
        <legend>{COPY.attributes}</legend>
        <p>{COPY.optionalAttributes}</p>
        {errors.attributes && (
          <p role="alert" className={styles['ManageProductForm-Error']}>
            {errors.attributes}
          </p>
        )}
        <div className={styles['ManageProductForm-Grid']}>
          {ATTRIBUTE_FIELDS[values.category].map((field) => (
            <Input
              key={field}
              label={COPY[field]}
              inputMode={isNumericAttribute(field) ? 'numeric' : undefined}
              value={values.attributes[field] ?? ''}
              errorText={errors[`attributes.${field}`]}
              helperText={
                attributeMax(field) !== undefined
                  ? COPY.rangeInvalid(attributeMax(field)!)
                  : undefined
              }
              onChange={(event) => {
                const value = event.target.value
                setValues((previous) => ({
                  ...previous,
                  attributes: { ...previous.attributes, [field]: value },
                }))
                setErrors((previous) => ({
                  ...previous,
                  [`attributes.${field}`]: undefined,
                  attributes: undefined,
                }))
              }}
            />
          ))}
        </div>
      </fieldset>
      <fieldset disabled={pending} className={styles['ManageProductForm-Section']}>
        <legend>{COPY.stock}</legend>
        <Input
          label={MANAGE_COPY.physicalQuantity}
          inputMode="numeric"
          value={values.stock_quantity}
          onChange={(event) => change('stock_quantity', event.target.value)}
          helperText={MANAGE_COPY.quantityHint}
          errorText={errors.stock_quantity}
          required
        />
        {product && (
          <div
            className={styles['ManageProductForm-Notice']}
            aria-label={COPY.currentAvailability}
          >
            <p>{MANAGE_COPY.available(product.available_quantity)}</p>
            <p>
              {MANAGE_COPY.quantities(
                product.stock_quantity,
                product.reserved_quantity,
              )}
            </p>
            <p>{COPY.availabilityHint}</p>
          </div>
        )}
        <label className={styles['ManageProductForm-Checkbox']}>
          <input
            type="checkbox"
            checked={values.is_published}
            onChange={(event) => change('is_published', event.target.checked)}
          />
          {COPY.publication}
        </label>
        {errors.is_published && (
          <p role="alert" className={styles['ManageProductForm-Error']}>
            {errors.is_published}
          </p>
        )}
        {demo && (
          <div className={styles['ManageProductForm-Notice']}>
            <p>{MANAGE_COPY.convertExplanation}</p>
            <label className={styles['ManageProductForm-Checkbox']}>
              <input
                type="checkbox"
                checked={consent}
                aria-invalid={!!errors.save_as_owner || undefined}
                aria-describedby={
                  errors.save_as_owner ? 'product-owner-consent-error' : undefined
                }
                onChange={(event) => {
                  setConsent(event.target.checked)
                  setErrors((previous) => ({ ...previous, save_as_owner: undefined }))
                }}
              />
              {MANAGE_COPY.demoConsent}
            </label>
            {errors.save_as_owner && (
              <p
                id="product-owner-consent-error"
                role="alert"
                className={styles['ManageProductForm-Error']}
              >
                {errors.save_as_owner}
              </p>
            )}
          </div>
        )}
      </fieldset>
      {formError && (
        <p role="alert" className={styles['ManageProductForm-Error']}>
          {formError}
        </p>
      )}
      <div className={styles['ManageProductForm-Actions']}>
        <Button type="submit" loading={pending} disabled={!!nextCategory}>
          {MANAGE_COPY.save}
        </Button>
        <Button variant="ghost" to={APP_ROUTES.manageProducts}>
          {MANAGE_COPY.backToProducts}
        </Button>
      </div>
    </form>
  )
}
