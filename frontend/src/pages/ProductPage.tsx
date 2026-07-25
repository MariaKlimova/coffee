import { useParams } from 'react-router-dom'

import { StubPage } from '@pages/StubPage'

export function ProductPage() {
  const { id } = useParams()
  return <StubPage title={`Product ${id ?? ''}`} />
}
