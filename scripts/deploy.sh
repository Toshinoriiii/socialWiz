#!/bin/bash

# SocialWiz 生产环境部署脚本

set -e  # 遇到错误立即退出

echo "========================================="
echo "  SocialWiz 生产环境部署"
echo "========================================="

# 1. 检查环境变量
echo ""
echo "步骤 1/6: 检查环境变量..."
if [ ! -f .env.local ]; then
  echo "错误: .env.local 文件不存在"
  echo "请复制 .env.example 到 .env.local 并配置生产环境变量"
  exit 1
fi
echo "✓ 环境变量文件存在"

# 2. 安装依赖
echo ""
echo "步骤 2/6: 安装依赖..."
pnpm install --frozen-lockfile
echo "✓ 依赖安装完成"

# 3. 生成 Prisma Client
echo ""
echo "步骤 3/6: 生成 Prisma Client..."
pnpm db:generate
echo "✓ Prisma Client 生成完成"

# 4. 数据库迁移
echo ""
echo "步骤 4/6: 执行数据库迁移..."
npx prisma migrate deploy
echo "✓ 数据库迁移完成"

# 5. 构建项目
echo ""
echo "步骤 5/6: 构建项目..."
pnpm build
echo "✓ 项目构建完成"

# 6. 启动服务
echo ""
echo "步骤 6/6: 启动生产服务..."
echo "运行命令: pnpm start"
echo ""
echo "========================================="
echo "  部署完成!"
echo "========================================="
echo ""
echo "提示:"
echo "  - 使用 PM2 或其他进程管理器保持服务运行"
echo "  - 配置 Nginx 反向代理"
echo "  - 设置 HTTPS 证书"
echo "  - 定期备份数据库"
echo ""
