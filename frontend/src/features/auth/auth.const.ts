/** Minimum password length aligned with the backend validators. */
export const PASSWORD_MIN_LENGTH = 8

/**
 * Form field names shared by login and register.
 */
export type AuthFieldName = 'email' | 'password' | 'password_confirm'

/**
 * User-facing copy for auth screens (product-voice, glossary).
 */
export const AUTH_COPY = {
  loginTitle: 'Вход',
  registerTitle: 'Регистрация',
  profileTitle: 'Профиль',
  emailLabel: 'Почта',
  passwordLabel: 'Пароль',
  passwordConfirmLabel: 'Повтори пароль',
  loginSubmit: 'Войти',
  registerSubmit: 'Создать аккаунт',
  logout: 'Выйти',
  loading: 'Загрузка…',
  loginFooterPrompt: 'Нет аккаунта?',
  loginFooterLink: 'Зарегистрироваться',
  registerFooterPrompt: 'Уже есть аккаунт?',
  registerFooterLink: 'Войти',
  emailRequired: 'Укажи почту',
  emailInvalid: 'Проверь адрес почты',
  passwordRequired: 'Укажи пароль',
  passwordTooShort: 'Пароль — минимум 8 символов',
  passwordConfirmRequired: 'Повтори пароль',
  passwordMismatch: 'Пароли должны совпадать',
  emailTaken: 'Такая почта уже занята',
  passwordInvalid: 'Пароль не подходит — попробуй другой',
  loginFailed: 'Не получилось войти. Проверь почту и пароль',
  genericError: 'Что-то пошло не так. Попробуй ещё раз',
  profileEmailLabel: 'Почта',
  profileNameLabel: 'Имя',
  profileNameEmpty: 'Не указано',
} as const
