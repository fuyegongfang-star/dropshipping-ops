import 'reflect-metadata'
import { ForbiddenException, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import { Roles, ROLES_KEY } from './roles.decorator'

/**
 * 角色守卫单测（任务 9.5，review A6）。
 * 覆盖：未声明角色 → 放行；平台管理员(super) → 放行；商户(seller) → 403；无 roles → 403。
 */
describe('RolesGuard（9.5 / A6）', () => {
  // 构造一个携带指定 roles 的请求上下文，并标记 handler 需要指定角色
  function ctxWithRoles(userRoles: string[] | undefined, required: string[]) {
    const handler = () => {}
    // 模拟 @Roles(...required) 写在方法上：直接写入方法元数据（与装饰器等价）
    Reflect.defineMetadata(ROLES_KEY, required, handler)
    const reflector = new Reflector()
    const guard = new RolesGuard(reflector)
    const req = { user: userRoles ? { roles: userRoles } : undefined }
    const context = {
      getHandler: () => handler,
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext
    return { guard, context }
  }

  it('接口未声明角色要求 → 直接放行', () => {
    const { guard, context } = ctxWithRoles(['seller'], [])
    expect(guard.canActivate(context)).toBe(true)
  })

  it('平台管理员（super）→ 放行（200 等效）', () => {
    const { guard, context } = ctxWithRoles(['super'], ['super', 'super_admin'])
    expect(guard.canActivate(context)).toBe(true)
    const { guard: g2, context: c2 } = ctxWithRoles(['super_admin'], ['super', 'super_admin'])
    expect(g2.canActivate(c2)).toBe(true)
  })

  it('商户租户（seller，超权）→ 403 Forbidden', () => {
    const { guard, context } = ctxWithRoles(['seller'], ['super', 'super_admin'])
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('未携带 roles（未登录 / 无角色）→ 403 Forbidden', () => {
    const { guard, context } = ctxWithRoles(undefined, ['super', 'super_admin'])
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
    const { guard: g2, context: c2 } = ctxWithRoles([], ['super', 'super_admin'])
    expect(() => g2.canActivate(c2)).toThrow(ForbiddenException)
  })

  it('@Roles 装饰器可正常写入元数据（结构验证）', () => {
    class Dummy {
      @Roles('super', 'super_admin')
      manage() {}
    }
    const reflector = new Reflector()
    const meta = reflector.get<string[]>('require_roles', new Dummy().manage)
    expect(meta).toEqual(['super', 'super_admin'])
  })
})
