export interface User {
  id: string
  email: string
  password: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface RegisterInput {
  email: string
  password: string
  name: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthResponse {
  user: UserProfile
  token: string
}

export interface UpdateProfileInput {
  name?: string
  avatar?: string
}
