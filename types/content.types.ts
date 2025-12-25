import { Platform } from './platform.types'

export enum ContentStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED'
}

export enum PublishStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface Content {
  id: string
  userId: string
  title: string
  content: string
  coverImage?: string
  images: string[]
  status: ContentStatus
  aiGenerated: boolean
  aiModel?: string
  scheduledAt?: Date
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ContentPlatform {
  id: string
  contentId: string
  platformAccountId: string
  platformContentId?: string
  publishStatus: PublishStatus
  errorMessage?: string
  publishedUrl?: string
  createdAt: Date
}

export interface CreateContentInput {
  title: string
  content: string
  coverImage?: string
  images?: string[]
  selectedPlatforms: string[]
  scheduledAt?: Date
}

export interface UpdateContentInput {
  title?: string
  content?: string
  coverImage?: string
  images?: string[]
  status?: ContentStatus
}

export interface AIGenerateInput {
  prompt: string
  template?: string
  model?: string
}

export interface AIGenerateResponse {
  content: string
  model: string
  tokensUsed?: number
}

export interface ContentMetrics {
  views: number
  comments: number
  likes: number
  shares: number
}

export interface ContentItem {
  id: string
  platform: Platform
  platformColor: string
  time: string
  content: string
  metrics: ContentMetrics
  image?: string
}
import { Platform } from './platform.types'

export enum ContentStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED'
}

export enum PublishStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface Content {
  id: string
  userId: string
  title: string
  content: string
  coverImage?: string
  images: string[]
  status: ContentStatus
  aiGenerated: boolean
  aiModel?: string
  scheduledAt?: Date
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface ContentPlatform {
  id: string
  contentId: string
  platformAccountId: string
  platformContentId?: string
  publishStatus: PublishStatus
  errorMessage?: string
  publishedUrl?: string
  createdAt: Date
}

export interface CreateContentInput {
  title: string
  content: string
  coverImage?: string
  images?: string[]
  selectedPlatforms: string[]
  scheduledAt?: Date
}

export interface UpdateContentInput {
  title?: string
  content?: string
  coverImage?: string
  images?: string[]
  status?: ContentStatus
}

export interface AIGenerateInput {
  prompt: string
  template?: string
  model?: string
}

export interface AIGenerateResponse {
  content: string
  model: string
  tokensUsed?: number
}

export interface ContentMetrics {
  views: number
  comments: number
  likes: number
  shares: number
}

export interface ContentItem {
  id: string
  platform: Platform
  platformColor: string
  time: string
  content: string
  metrics: ContentMetrics
  image?: string
}
