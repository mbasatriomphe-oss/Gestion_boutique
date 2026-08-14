"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem" }}>
          <h2>Une erreur critique s&apos;est produite</h2>
          <p>{error.message}</p>
          <button onClick={reset}>Réessayer</button>
        </div>
      </body>
    </html>
  )
}
