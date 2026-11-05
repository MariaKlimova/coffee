import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { bindStaff, selectCanManage, useAuthStore } from '@entities/user'

import { fetchManageOrder, fetchManageOrders } from '../api/manageOrdersApi'
import type { ManageOrderFilters } from '../api/manageOrdersApi.typings'

function useStaffScope() {
  const client = useQueryClient()
  const generation = useAuthStore((state) => state.sessionGeneration)
  const userId = useAuthStore((state) => state.user?.id)
  const enabled = useAuthStore(selectCanManage)
  useEffect(() => {
    const key = ['manage-orders', generation, userId]
    return () => {
      void client.cancelQueries({ queryKey: key })
      client.removeQueries({ queryKey: key })
    }
  }, [client, generation, userId, enabled])
  return {
    prefix: ['manage-orders', generation, userId] as const,
    enabled,
    assertStaff: bindStaff(),
  }
}

export function useManageOrders(filters: ManageOrderFilters, valid: boolean) {
  const { prefix, enabled, assertStaff } = useStaffScope()
  return useQuery({
    queryKey: [...prefix, 'list', filters],
    queryFn: ({ signal }) => fetchManageOrders(filters, signal, assertStaff),
    enabled: enabled && valid,
    gcTime: 0,
  })
}

export function useManageOrder(id: string, available = true) {
  const { prefix, enabled, assertStaff } = useStaffScope()
  return useQuery({
    queryKey: [...prefix, 'detail', id],
    queryFn: ({ signal }) => fetchManageOrder(id, signal, assertStaff),
    enabled: enabled && Boolean(id) && available,
    gcTime: 0,
  })
}
