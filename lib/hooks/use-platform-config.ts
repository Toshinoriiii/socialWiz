'use client'

/**
 * 平台配置管理 React Hook
 * Feature: 006-platform-publish-config
 * 
 * 提供配置的CRUD操作和状态管理
 */

import { useState, useCallback } from 'react'
import { Platform } from '@/types/platform.types'
import type {
  PlatformPublishConfig,
  CreateConfigInput,
  UpdateConfigInput,
  GetConfigsParams
} from '@/types/platform-config.types'

interface UsePlatformConfigOptions {
  platform?: Platform
  autoLoad?: boolean
}

export function usePlatformConfig(options: UsePlatformConfigOptions = {}) {
  const [configs, setConfigs] = useState<PlatformPublishConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  /**
   * 加载配置列表
   */
  const loadConfigs = useCallback(async (params?: GetConfigsParams) => {
    if (!userId) {
      console.warn('userId is required for loadConfigs')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams()
      queryParams.append('userId', userId)
      if (params?.platform) queryParams.append('platform', params.platform)
      if (params?.isDefault !== undefined) queryParams.append('isDefault', String(params.isDefault))

      const response = await fetch(`/api/platforms/publish-configs?${queryParams}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '加载配置失败')
      }

      const data = await response.json()
      setConfigs(data.configs || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载配置失败'
      setError(errorMessage)
      console.error('Load configs error:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  /**
   * 创建配置
   */
  const createConfig = useCallback(async (input: CreateConfigInput) => {
    if (!userId) {
      throw new Error('userId is required')
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/platforms/publish-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...input, userId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '创建配置失败')
      }

      const newConfig = await response.json()
      setConfigs(prev => [...prev, newConfig])
      return newConfig as PlatformPublishConfig
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建配置失败'
      setError(errorMessage)
      console.error('Create config error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 更新配置
   */
  const updateConfig = useCallback(async (configId: string, input: UpdateConfigInput) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/platforms/publish-configs/${configId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '更新配置失败')
      }

      const updatedConfig = await response.json()
      setConfigs(prev => prev.map(c => c.id === configId ? updatedConfig : c))
      return updatedConfig as PlatformPublishConfig
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新配置失败'
      setError(errorMessage)
      console.error('Update config error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 删除配置
   */
  const deleteConfig = useCallback(async (configId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/platforms/publish-configs/${configId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '删除配置失败')
      }

      setConfigs(prev => prev.filter(c => c.id !== configId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除配置失败'
      setError(errorMessage)
      console.error('Delete config error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 设置默认配置
   */
  const setDefaultConfig = useCallback(async (configId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/platforms/publish-configs/${configId}/set-default`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '设置默认配置失败')
      }

      const updatedConfig = await response.json()
      
      // 更新本地状态: 取消其他配置的默认状态,设置当前配置为默认
      setConfigs(prev => prev.map(c => ({
        ...c,
        isDefault: c.id === configId
      })))

      return updatedConfig as PlatformPublishConfig
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '设置默认配置失败'
      setError(errorMessage)
      console.error('Set default config error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 获取单个配置
   */
  const getConfig = useCallback(async (configId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/platforms/publish-configs/${configId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '获取配置失败')
      }

      const config = await response.json()
      return config as PlatformPublishConfig
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取配置失败'
      setError(errorMessage)
      console.error('Get config error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    configs,
    loading,
    error,
    loadConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    setDefaultConfig,
    getConfig
  }
}
