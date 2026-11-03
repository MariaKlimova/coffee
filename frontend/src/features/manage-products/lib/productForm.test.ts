import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { MANAGE_COPY, PRODUCT_FORM_COPY as COPY } from '@shared/lib/copy'
import { formPayload, initialForm, mapFormError, validateForm } from './productForm'

const valid = {
  ...initialForm(),
  name: 'Кофе',
  short_description: 'Описание',
  price: '450,25',
  stock_quantity: '3',
}
describe('Валидация формы товара', () => {
  it('принимает нулевое количество и границы характеристик, нормализует цену', () => {
    const values = {
      ...valid,
      stock_quantity: '0',
      attributes: { intensity: '13', bitterness: '0' },
      old_price: '500,50',
    }
    expect(validateForm(values, false, false)).toEqual({})
    expect(formPayload(values, false)).toMatchObject({
      stock_quantity: 0,
      price: '450.25',
      old_price: '500.50',
      attributes: { intensity: 13, bitterness: 0 },
    })
  })
  it('проверяет обязательные строки, границы цены, старую цену и шкалы', () => {
    expect(
      validateForm(
        {
          ...valid,
          name: ' ',
          short_description: '',
          price: '-1',
          old_price: '100000000',
          attributes: { intensity: '14', roast: '1.5' },
        },
        false,
        false,
      ),
    ).toEqual({
      name: COPY.required,
      short_description: COPY.required,
      price: COPY.moneyInvalid,
      old_price: COPY.moneyInvalid,
      'attributes.intensity': COPY.rangeInvalid(13),
      'attributes.roast': COPY.rangeInvalid(5),
    })
    expect(
      validateForm({ ...valid, old_price: '450.25' }, false, false).old_price,
    ).toBe(COPY.oldPriceInvalid)
  })
  it('проверяет длины текста, точность денег и целые характеристики машин', () => {
    expect(
      validateForm(
        {
          ...valid,
          name: 'а'.repeat(256),
          short_description: 'а'.repeat(301),
          price: '1.234',
          category: 'machines',
          attributes: { power_w: '-1', pressure_bar: '2.5' },
        },
        false,
        false,
      ),
    ).toMatchObject({
      name: COPY.nameLength,
      short_description: COPY.shortLength,
      price: COPY.moneyInvalid,
      'attributes.power_w': COPY.integerInvalid,
      'attributes.pressure_bar': COPY.integerInvalid,
    })
  })
  it('не переносит в другую категорию лишние характеристики и не конвертирует owner', () => {
    expect(
      formPayload(
        {
          ...valid,
          category: 'machines',
          attributes: { intensity: '7', power_w: '1200', dimensions: ' 20 × 30 см ' },
        },
        false,
      ),
    ).toMatchObject({ attributes: { power_w: 1200, dimensions: '20 × 30 см' } })
    expect(formPayload(valid, false)).not.toHaveProperty('save_as_owner')
  })
  it('переводит вложенные и общие серверные ошибки без сырых сообщений', () => {
    const error = new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: '',
      headers: new AxiosHeaders(),
      config: { headers: new AxiosHeaders() },
      data: {
        errors: {
          attributes: { pressure_bar: ['Internal message'] },
          save_as_owner: ['Required'],
          name: ['Invalid'],
        },
      },
    })
    expect(mapFormError(error)).toEqual({
      'attributes.pressure_bar': COPY.fieldInvalid,
      save_as_owner: MANAGE_COPY.demoConsentRequired,
      name: COPY.fieldInvalid,
    })
    expect(mapFormError(new Error('Network error'))).toEqual({})
  })
})
