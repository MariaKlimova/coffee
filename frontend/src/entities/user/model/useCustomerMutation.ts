import {
  useMutation,
  type MutateOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { isSameCustomerSession, selectCanShop } from './accountAccess'
import { useAuthStore } from './authStore'

type BoundVariables<TVariables> = {
  /** Исходные аргументы без данных авторизации. */
  values: TVariables
  /** Проверка неизменного инициатора этого конкретного вызова. */
  isCurrentActor: () => boolean
}

type CustomerMutationOptions<TData, TVariables, TContext> = Omit<
  UseMutationOptions<TData, Error, TVariables, TContext>,
  'mutationFn'
> & {
  /** Отправка получает проверку того же инициатора для транспортной границы. */
  mutationFn: (variables: TVariables, assertActor: () => void) => Promise<TData>
}

/** Захватывает отдельную сессию для каждого вызова, включая параллельные мутации. */
function bindActor<TVariables>(values: TVariables): BoundVariables<TVariables> {
  const actor = useAuthStore.getState()
  const wasAllowed = selectCanShop(actor)
  return {
    values,
    isCurrentActor: () =>
      wasAllowed && isSameCustomerSession(actor, useAuthStore.getState()),
  }
}

function assertCurrentActor(isCurrentActor: () => boolean): void {
  if (!isCurrentActor()) throw new Error('Покупательское действие больше недоступно')
}

/** Не позволяет отложенной мутации продолжиться от гостя или другого покупателя. */
export function useCustomerMutation<TData, TVariables, TContext>(
  options: CustomerMutationOptions<TData, TVariables, TContext>,
) {
  const mutation = useMutation<
    TData,
    Error,
    BoundVariables<TVariables>,
    TContext | undefined
  >({
    ...options,
    mutationFn: ({ values, isCurrentActor }) => {
      const assertActor = () => assertCurrentActor(isCurrentActor)
      assertActor()
      return options.mutationFn(values, assertActor)
    },
    onMutate: async ({ values, isCurrentActor }, context) => {
      assertCurrentActor(isCurrentActor)
      const result = await options.onMutate?.(values, context)
      // Возврат undefined не отменяет TanStack mutationFn — смена actor требует throw.
      assertCurrentActor(isCurrentActor)
      return result
    },
    onSuccess: (data, { values, isCurrentActor }, result, context) => {
      if (isCurrentActor())
        return options.onSuccess?.(data, values, result as TContext, context)
    },
    onError: (error, { values, isCurrentActor }, result, context) => {
      if (isCurrentActor()) return options.onError?.(error, values, result, context)
    },
    onSettled: (data, error, { values, isCurrentActor }, result, context) => {
      if (isCurrentActor())
        return options.onSettled?.(data, error, values, result, context)
    },
  })

  function wrapOptions(
    callOptions?: MutateOptions<TData, Error, TVariables, TContext | undefined>,
  ): MutateOptions<TData, Error, BoundVariables<TVariables>, TContext | undefined> {
    return {
      onSuccess: (data, { values, isCurrentActor }, result, context) => {
        if (isCurrentActor()) callOptions?.onSuccess?.(data, values, result, context)
      },
      onError: (error, { values, isCurrentActor }, result, context) => {
        if (isCurrentActor()) callOptions?.onError?.(error, values, result, context)
      },
      onSettled: (data, error, { values, isCurrentActor }, result, context) => {
        if (isCurrentActor())
          callOptions?.onSettled?.(data, error, values, result, context)
      },
    }
  }

  return {
    ...mutation,
    variables: mutation.variables?.values,
    mutate: (
      values: TVariables,
      callOptions?: MutateOptions<TData, Error, TVariables, TContext | undefined>,
    ) => mutation.mutate(bindActor(values), wrapOptions(callOptions)),
    mutateAsync: (
      values: TVariables,
      callOptions?: MutateOptions<TData, Error, TVariables, TContext | undefined>,
    ) => mutation.mutateAsync(bindActor(values), wrapOptions(callOptions)),
  }
}
