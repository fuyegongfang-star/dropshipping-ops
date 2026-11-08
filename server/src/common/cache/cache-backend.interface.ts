/**
 * 缓存后端抽象（任务 11.3 分布式缓存，方案 §10.3）。
 *
 * 业务层只依赖此接口，可在「进程内存后端」与「Redis 共享后端」间无感切换，
 * 以满足多实例部署下令牌 / FX 等共享缓存需求，同时保证单实例 / 沙箱零依赖可跑。
 */
export interface CacheBackend {
  /** 读取字符串值；不存在或已过期返回 null */
  get(key: string): Promise<string | null>

  /**
   * 写入字符串值。
   * @param ttlSec 过期秒数；>0 设置 TTL，<=0 表示不过期。
   */
  set(key: string, value: string, ttlSec?: number): Promise<void>

  /** 删除键 */
  del(key: string): Promise<void>

  /** 键是否存在（未过期） */
  exists(key: string): Promise<boolean>
}
