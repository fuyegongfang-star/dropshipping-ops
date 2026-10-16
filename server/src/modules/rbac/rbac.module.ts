import { Module } from '@nestjs/common'
import { RbacController } from './rbac.controller'
import { PrismaModule } from '../../database/prisma.module'

/**
 * RBAC 模块（任务 4.5，§22）：权限目录/角色管理接口。
 * PermissionsGuard 与 RequirePermissions 来自公共鉴权模块，PrismaService 经全局 PrismaModule 注入。
 */
@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
})
export class RbacModule {}
