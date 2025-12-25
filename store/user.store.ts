import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@/types/user.types'

interface UserState {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  setUser: (user: UserProfile, token: string) => void
  clearUser: () => void
  updateProfile: (updates: Partial<UserProfile>) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true
        }),

      clearUser: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false
        }),

      updateProfile: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        }))
    }),
    {
      name: 'user-storage'
    }
  )
)
