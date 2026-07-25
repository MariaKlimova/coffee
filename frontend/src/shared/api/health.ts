import { http } from '@shared/api/http'

/**
 * Response payload of the backend health endpoint.
 */
export interface HealthResponse {
  /** Service liveness marker. */
  status: string
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await http.get<HealthResponse>('/api/health/')
  return data
}
