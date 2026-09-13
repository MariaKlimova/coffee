/**
 * Pre-commit: eslint --fix только по staged frontend-файлам.
 * Пути от корня репо обрезаются до relative-to-frontend.
 */
export default {
  'frontend/**/*.{ts,tsx}': (filenames) => {
    const relative = filenames
      .filter((file) => file.startsWith('frontend/'))
      .map((file) => file.slice('frontend/'.length))

    if (relative.length === 0) {
      return []
    }

    const quoted = relative.map((file) => `"${file}"`).join(' ')
    return [
      `npm --prefix frontend exec -- eslint --fix --max-warnings=0 ${quoted}`,
    ]
  },
}
