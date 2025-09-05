// app/providers.tsx
'use client'

import { AuthProvider } from './context/AuthContext'
import { AgentProvider } from './context/AgentContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AgentProvider>
        {children}
      </AgentProvider>
    </AuthProvider>
  )
}