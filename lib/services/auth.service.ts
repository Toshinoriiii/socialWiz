import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/db/prisma'
import { cacheHelper } from '@/lib/db/redis'
import type { RegisterInput, LoginInput, AuthResponse, UserProfile } from '@/types/user.types'
import { registerSchema, loginSchema } from '@/lib/utils/validation'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'
const SALT_ROUNDS = 10

/**
 * 用户认证服务
 */
export class AuthService {
  /**
   * 用户注册
   */
  static async register (input: RegisterInput): Promise<AuthResponse> {
    // 验证输入数据
    const validation = registerSchema.safeParse(input)
    if (!validation.success) {
      throw new Error(validation.error.issues[0].message)
    }

    const { email, password, name } = validation.data

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      throw new Error('邮箱已被注册')
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    })

    // 生成JWT token
    const token = this.generateToken(user.id)

    // 缓存用户信息
    await this.cacheUserProfile(user.id, this.toUserProfile(user))

    return {
      user: this.toUserProfile(user),
      token
    }
  }

  /**
   * 用户登录
   */
  static async login (input: LoginInput): Promise<AuthResponse> {
    // 验证输入数据
    const validation = loginSchema.safeParse(input)
    if (!validation.success) {
      throw new Error(validation.error.issues[0].message)
    }

    const { email, password } = validation.data

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      throw new Error('邮箱或密码错误')
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new Error('邮箱或密码错误')
    }

    // 生成JWT token
    const token = this.generateToken(user.id)

    // 缓存用户信息
    await this.cacheUserProfile(user.id, this.toUserProfile(user))

    return {
      user: this.toUserProfile(user),
      token
    }
  }

  /**
   * 验证JWT token
   */
  static async verifyToken (token: string): Promise<UserProfile> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
      
      // 先从缓存获取用户信息
      const cachedUser = await this.getCachedUserProfile(decoded.userId)
      if (cachedUser) {
        return cachedUser
      }

      // 缓存未命中，从数据库查询
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })

      if (!user) {
        throw new Error('用户不存在')
      }

      const userProfile = this.toUserProfile(user)
      
      // 更新缓存
      await this.cacheUserProfile(user.id, userProfile)

      return userProfile
    } catch (error) {
      throw new Error('Token无效或已过期')
    }
  }

  /**
   * 通过用户ID获取用户信息
   */
  static async getUserById (userId: string): Promise<UserProfile | null> {
    // 先从缓存获取
    const cachedUser = await this.getCachedUserProfile(userId)
    if (cachedUser) {
      return cachedUser
    }

    // 从数据库查询
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return null
    }

    const userProfile = this.toUserProfile(user)
    
    // 更新缓存
    await this.cacheUserProfile(userId, userProfile)

    return userProfile
  }

  /**
   * 登出（清除缓存）
   */
  static async logout (userId: string): Promise<void> {
    await cacheHelper.del(`user:${userId}`)
  }

  /**
   * 生成JWT token
   */
  private static generateToken (userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  }

  /**
   * 转换为UserProfile（去除密码等敏感信息）
   */
  private static toUserProfile (user: any): UserProfile {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  }

  /**
   * 缓存用户信息
   */
  private static async cacheUserProfile (userId: string, profile: UserProfile): Promise<void> {
    await cacheHelper.set(`user:${userId}`, profile, 3600) // 缓存1小时
  }

  /**
   * 从缓存获取用户信息
   */
  private static async getCachedUserProfile (userId: string): Promise<UserProfile | null> {
    return await cacheHelper.get<UserProfile>(`user:${userId}`)
  }
}
