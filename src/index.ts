#!/usr/bin/env node

import { execSync, spawn, type ExecSyncOptionsWithStringEncoding, type SpawnOptions } from 'child_process'
import readline from 'readline'
import path from 'path'
import fs from 'fs'
import _os from 'os'

// ==================== 平台与语言检测 ====================

/**
 * 操作系统类型枚举
 */
const OS_TYPE = {
  WINDOWS: 'win32',
  LINUX: 'linux',
  MACOS: 'darwin'
}

/**
 * 当前操作系统
 */
const CURRENT_OS = process.platform

/**
 * 是否为 Windows 系统
 */
const IS_WINDOWS = CURRENT_OS === OS_TYPE.WINDOWS

/**
 * 是否为 macOS 系统
 */
const IS_MACOS = CURRENT_OS === OS_TYPE.MACOS

/**
 * 是否为 Linux 系统
 */
const IS_LINUX = CURRENT_OS === OS_TYPE.LINUX

/**
 * 获取系统语言代码（优先从命令行参数，其次环境变量，最后 Intl API）
 * @returns {string} 'zh' | 'en' | 其他
 */
function detectSystemLang() {
  // 1. 优先检查命令行参数 --lang=zh 或 --locale=en
  const args = process.argv.slice(2)
  for (const arg of args) {
    const langMatch = arg.match(/^--(?:lang|locale)=(.+)$/i)
    if (langMatch) {
      const code = langMatch[1].toLowerCase().trim()
      return code.startsWith('zh') ? 'zh' : 'en'
    }
  }

  // 2. 检查环境变量（Linux/macOS 常用）
  const envLang = (process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.USERLANGUAGE || '').toLowerCase()

  if (envLang.includes('zh')) return 'zh'
  if (envLang.includes('en')) return 'en'

  // 3. Windows 专用：尝试通过 PowerShell 获取区域设置
  if (IS_WINDOWS) {
    try {
      const region = execSync('powershell -Command "[System.Globalization.CultureInfo]::CurrentCulture.Name"', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe'
      })
        .trim()
        .toLowerCase()
      if (region.startsWith('zh')) return 'zh'
      if (region.startsWith('en')) return 'en'
    } catch {
      // 静默失败，继续 fallback
    }
  }

  // 4. Node.js Intl API fallback
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
    if (intlLocale.startsWith('zh')) return 'zh'
    if (intlLocale.startsWith('en')) return 'en'
  } catch {
    // Intl 不可用时的 fallback
  }

  // 5. 最终默认：简体中文
  return 'zh'
}

/**
 * 当前语言代码
 */
const LANG = detectSystemLang()

/**
 * 国际化文案
 */
const i18n = {
  zh: {
    checkingDeps: '🔍 全局前置检查：校验依赖是否完整...',
    depsOk: '✅ 依赖检查通过',
    depsMissing: '❌ 依赖缺失或版本不匹配！',
    detail: '详情',
    promptInstall: '👉 是否立即执行 npm install？(y/n)：',
    installing: '🚀 正在执行 npm install...',
    installOk: '✅ 依赖安装成功！',
    installFail: '❌ npm install 失败',
    reason: '原因',
    cancelled: '🚫 已取消安装，退出进程',
    cmdEmpty: '❌ 命令参数为空',
    executing: '▶️ 执行命令',
    cmdDone: '✅ 命令执行完成',
    error: '❌ 执行出错',
    uncaught: '💥 未捕获的异常',
    pkgNotFound: '当前目录未找到 package.json',
    npmNotFound: 'npm 未安装或不在 PATH 中，请检查 Node.js 环境',
    exitCode: '命令退出码',
    // 系统信息提示
    osInfo: '操作系统',
    osWindows: 'Windows',
    osLinux: 'Linux',
    osMacos: 'macOS',
    osUnknown: '未知',
    langInfo: '语言'
  },
  en: {
    checkingDeps: '🔍 Pre-checking dependencies...',
    depsOk: '✅ Dependencies OK',
    depsMissing: '❌ Dependencies missing or version mismatch!',
    detail: 'Detail',
    promptInstall: '👉 Run npm install now? (y/n): ',
    installing: '🚀 Running npm install...',
    installOk: '✅ Dependencies installed successfully!',
    installFail: '❌ npm install failed',
    reason: 'Reason',
    cancelled: '🚫 Installation cancelled, exiting',
    cmdEmpty: '❌ Command argument is empty',
    executing: '▶️ Executing command',
    cmdDone: '✅ Command completed',
    error: '❌ Error',
    uncaught: '💥 Uncaught exception',
    pkgNotFound: 'package.json not found in current directory',
    npmNotFound: 'npm is not installed or not in PATH, please check your Node.js environment',
    exitCode: 'Exit code',
    osInfo: 'OS',
    osWindows: 'Windows',
    osLinux: 'Linux',
    osMacos: 'macOS',
    osUnknown: 'Unknown',
    langInfo: 'Language'
  }
}

/**
 * 获取本地化文案
 * @param {string} key - 文案键
 * @returns {string}
 */
function t(key) {
  return i18n[LANG]?.[key] ?? i18n.zh[key] ?? key
}

/**
 * 获取操作系统显示名称
 * @returns {string}
 */
function getOsDisplayName() {
  if (IS_WINDOWS) return t('osWindows')
  if (IS_LINUX) return t('osLinux')
  if (IS_MACOS) return t('osMacos')
  return t('osUnknown')
}

// ==================== 配置常量 ====================

const NPM_CMD = IS_WINDOWS ? 'npm.cmd' : 'npm'
const EXEC_TIMEOUT_MS = 300_000 // 5 分钟超时
const ENCODING = 'utf8'

// ==================== 工具函数 ====================

/**
 * 安全关闭 readline 接口
 */
function safeCloseRl(rl) {
  if (rl && !rl.closed) {
    rl.close()
  }
}

/**
 * 创建 readline 接口
 */
function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
}

/**
 * 终端输入提示（自动聚焦）
 */
function focusPrompt(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.setPrompt(query)
    rl.prompt()
    rl.once('line', (ans) => resolve(ans.trim()))
  })
}

/**
 * 安全执行同步命令（避免 shell 注入）
 */
function safeExec(command: string, args: string[], options: Partial<ExecSyncOptionsWithStringEncoding> = {}) {
  const execOptions: ExecSyncOptionsWithStringEncoding = {
    encoding: ENCODING,
    timeout: EXEC_TIMEOUT_MS,
    cwd: process.cwd(),
    stdio: 'pipe',
    ...options
  }
  return execSync(`${command} ${args.join(' ')}`, execOptions)
}

/**
 * 以继承 stdio 的方式执行命令（用于需要交互的场景）
 */
function execInherit(command: string, args: string[], options: SpawnOptions = {}): Promise<void> {
  // Windows 上 spawn .cmd/.bat 必须启用 shell（Node.js v18.20+ / v20.12+ 行为变更）
  const needsShell = IS_WINDOWS && /\.(cmd|bat)$/i.test(command)

  const result = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: needsShell,
    ...options
  })

  return new Promise((resolve, reject) => {
    result.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${t('exitCode')}: ${code}`))
      }
    })
    result.on('error', (err) => reject(err))
  })
}

/**
 * 检查 package.json 是否存在
 */
function checkPackageJson() {
  const pkgPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`${t('pkgNotFound')}: ${process.cwd()}`)
  }
}

/**
 * 检查 npm 是否可用
 */
function checkNpmAvailable() {
  try {
    execSync(`${NPM_CMD} --version`, { encoding: ENCODING, stdio: 'ignore' })
  } catch {
    throw new Error(t('npmNotFound'))
  }
}

// ==================== 主逻辑 ====================

async function run() {
  const rl = createRl()

  try {
    // 打印系统信息
    console.log(`[${t('osInfo')}: ${getOsDisplayName()} (${CURRENT_OS}) | ${t('langInfo')}: ${LANG.toUpperCase()}]`)
    console.log()

    // 前置环境检查
    checkPackageJson()
    checkNpmAvailable()

    // 1. 依赖校验
    console.log(t('checkingDeps'))
    try {
      safeExec(NPM_CMD, ['list', '--depth=0'], { stdio: 'ignore' })
      console.log(`${t('depsOk')}\n`)
    } catch (err) {
      console.error(`${t('depsMissing')}`)
      console.error(`   ${t('detail')}: ${err.message}\n`)

      // 自动聚焦，直接键盘输入 y/n 即可
      const answer = await focusPrompt(rl, t('promptInstall'))

      if (['y', 'yes'].includes(answer.toLowerCase())) {
        console.log(`\n${t('installing')}\n`)
        try {
          await execInherit(NPM_CMD, ['install'])
          console.log(`\n${t('installOk')}\n`)
        } catch (e) {
          console.error(`\n${t('installFail')}`)
          console.error(`   ${t('reason')}: ${e.message}\n`)
          process.exitCode = 1
          return
        }
      } else {
        console.log(`\n${t('cancelled')}\n`)
        process.exitCode = 1
        return
      }
    }

    // 2. 执行后续命令
    const args = process.argv.slice(2).filter((arg) => !arg.match(/^--(?:lang|locale)=/i))
    if (!args.length) {
      process.exitCode = 0
      return
    }

    // 使用 spawn + shell: false 防止命令注入，第一个参数作为命令，其余作为参数
    const [cmd, ...cmdArgs] = args
    if (!cmd) {
      console.error(`${t('cmdEmpty')}\n`)
      process.exitCode = 1
      return
    }

    console.log(`${t('executing')}: ${cmd} ${cmdArgs.join(' ')}\n`)
    await execInherit(cmd, cmdArgs, { shell: IS_WINDOWS })
    console.log(`\n${t('cmdDone')}\n`)
    process.exitCode = 0
  } catch (err) {
    console.error(`\n${t('error')}: ${err.message}\n`)
    process.exitCode = 1
  } finally {
    safeCloseRl(rl)
  }
}

// ==================== 入口 ====================

run()
  .then(() => {
    process.exit()
  })
  .catch((err) => {
    console.error(`\n${t('uncaught')}: ${err.message}\n`)
    process.exitCode = 1
    process.exit()
  })
