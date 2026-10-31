/**
 * 平台凭证保存 DTO（任务 8.2，方案 §17.2 凭证工厂化接入）。
 *
 * 前端按平台动态字段录入，统一以 { platform, fields } 提交；
 * 必填校验交由 PlatformCredentialService.assertRequired（对齐 PLATFORM_META.requiredFields）完成，
 * 此处只校验平台代码合法 + fields 为非空对象，避免重复维护字段白名单。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-30 夜间批次（8.2）
 */

import { IsIn, IsObject, IsString } from 'class-validator'
import { PLATFORM_META, PlatformKind } from '../platform-credentials.constants'

export class SaveCredentialDto {
  /** 平台代码（对齐 PLATFORM_META 的枚举键） */
  @IsString()
  @IsIn(Object.keys(PLATFORM_META) as PlatformKind[])
  platform: PlatformKind

  /** 凭证字段（键值对，明文由本接口负责加密落库，绝不落明文） */
  @IsObject()
  fields: Record<string, string>
}
