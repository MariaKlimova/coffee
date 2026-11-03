import { useParams } from 'react-router-dom'
import { ManageProductForm } from '@features/manage-products'

export function ManageProductEditPage() {
  const { id } = useParams<{ id: string }>()
  return <ManageProductForm id={id} />
}
