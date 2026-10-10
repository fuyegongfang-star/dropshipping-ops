import { Module } from '@nestjs/common'
import { UsersService } from './users.service'

/** 用户模块（最小实现，供 AuthModule 复用，§22 阶段扩展） */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
