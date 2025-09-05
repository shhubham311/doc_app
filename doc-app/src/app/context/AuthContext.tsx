'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

type User = {
  id: string
  email: string
  name: string
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  token: string | null
  isLoading: boolean
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load user from localStorage on mount and verify token
  useEffect(() => {
    const initializeAuth = async () => {
      if (typeof window !== 'undefined') {
        const savedToken = localStorage.getItem('auth_token')
        const savedUser = localStorage.getItem('user')
        
        if (savedToken && savedUser) {
          try {
            // Verify token with backend
            const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
              headers: {
                'Authorization': `Bearer ${savedToken}`,
                'Content-Type': 'application/json'
              }
            })

            if (response.ok) {
              const data = await response.json()
              setToken(savedToken)
              setUser(data.user)
              console.log('Token verified, user restored:', data.user)
            } else {
              // Token is invalid, clear it
              console.log('Saved token is invalid, clearing auth')
              localStorage.removeItem('auth_token')
              localStorage.removeItem('user')
            }
          } catch (error) {
            console.error('Error verifying saved token:', error)
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user')
          }
        }
      }
      setIsLoading(false)
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login with backend...')
      
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Login successful:', data)
        
        if (data.token && data.user) {
          setUser(data.user)
          setToken(data.token)
          
          // Save to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
          }
          return
        } else {
          throw new Error('Invalid response format from server')
        }
      } else {
        const errorData = await response.json()
        console.error('Login failed:', errorData)
        throw new Error(errorData.detail || 'Login failed')
      }
      
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const register = async (name: string, email: string, password: string) => {
    try {
      console.log('Attempting registration with backend...')
      
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Registration successful:', data)
        
        if (data.token && data.user) {
          setUser(data.user)
          setToken(data.token)
          
          // Save to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
          }
          return
        } else {
          throw new Error('Invalid response format from server')
        }
      } else {
        const errorData = await response.json()
        console.error('Registration failed:', errorData)
        throw new Error(errorData.detail || 'Registration failed')
      }
      
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      // Optionally call backend logout endpoint if you have one
      if (token) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(error => {
          console.log('Backend logout failed (this is okay):', error)
        })
      }
    } catch (error) {
      console.log('Logout request failed (this is okay):', error)
    } finally {
      // Always clear local state
      setUser(null)
      setToken(null)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
      }
    }
  }

  // Helper function to make authenticated API calls
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('No authentication token available')
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }

    const response = await fetch(`${BACKEND_URL}${url}`, {
      ...options,
      headers
    })

    if (response.status === 401) {
      // Token is invalid, logout user
      console.log('Authentication failed, logging out user')
      logout()
      throw new Error('Authentication failed')
    }

    return response
  }

  const contextValue = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    makeAuthenticatedRequest
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}