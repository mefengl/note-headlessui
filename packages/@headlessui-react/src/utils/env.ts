/**
 * 渲染环境类型
 * client - 浏览器环境
 * server - 服务器环境(Node.js)
 */
type RenderEnv = 'client' | 'server'

/**
 * 服务器到客户端交接状态
 * pending - 等待交接完成
 * complete - 交接已完成
 */
type HandoffState = 'pending' | 'complete'

/**
 * 环境管理类
 * 
 * 负责:
 * 1. 检测和管理当前的渲染环境(服务器/客户端)
 * 2. 处理SSR时的服务器到客户端的交接过程
 * 3. 生成递增的唯一ID
 * 
 * 重要概念:
 * - 环境检测: 通过window和document对象的存在与否判断环境
 * - 交接状态: 跟踪SSR水合过程的完成情况
 * - ID生成: 提供递增的唯一标识符
 */
class Env {
  /** 当前渲染环境 */
  current: RenderEnv = this.detect()
  /** 当前交接状态 */
  handoffState: HandoffState = 'pending'
  /** 当前ID计数器 */
  currentId = 0

  /**
   * 设置当前环境
   * 同时会重置交接状态和ID计数器
   */
  set(env: RenderEnv): void {
    if (this.current === env) return
    this.handoffState = 'pending'
    this.currentId = 0
    this.current = env
  }

  /** 重置环境到自动检测的状态 */
  reset(): void {
    this.set(this.detect())
  }

  /** 生成下一个唯一ID */
  nextId() {
    return ++this.currentId
  }

  /** 判断是否为服务器环境 */
  get isServer(): boolean {
    return this.current === 'server'
  }

  /** 判断是否为客户端环境 */
  get isClient(): boolean {
    return this.current === 'client'
  }

  /**
   * 检测当前环境
   * 通过检查window和document对象来判断是否在浏览器中运行
   */
  private detect(): RenderEnv {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 'server'
    }
    return 'client'
  }

  /**
   * 标记服务器到客户端的交接完成
   * 在React水合完成后调用
   */
  handoff(): void {
    if (this.handoffState === 'pending') {
      this.handoffState = 'complete'
    }
  }

  /** 判断交接是否完成 */
  get isHandoffComplete(): boolean {
    return this.handoffState === 'complete'
  }
}

/** 导出环境管理实例 */
export let env = new Env()
