interface StubPageProps {
  /** Visible page title rendered as the stub content. */
  title: string
}

export function StubPage({ title }: StubPageProps) {
  return (
    <main>
      <h1>{title}</h1>
    </main>
  )
}
