import axios from 'axios'

/**
 * Tells "the backend has no such resource" apart from network or server failures.
 */
export function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}
