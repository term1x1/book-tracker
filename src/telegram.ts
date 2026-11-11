// Тонкая обёртка над Telegram WebApp API с безопасным фолбэком
// для запуска в обычном браузере (разработка).

interface CloudStorage {
  setItem(key: string, value: string, cb?: (err: Error | null, ok?: boolean) => void): void
  getItem(key: string, cb: (err: Error | null, value?: string) => void): void
  getItems(keys: string[], cb: (err: Error | null, values?: Record<string, string>) => void): void
  removeItems(keys: string[], cb?: (err: Error | null, ok?: boolean) => void): void
  getKeys(cb: (err: Error | null, keys?: string[]) => void): void
}

interface TelegramWebApp {
  ready(): void
  expand(): void
  disableVerticalSwipes?(): void
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string>
  CloudStorage?: CloudStorage
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
  }
  onEvent(event: string, handler: () => void): void
  isVersionAtLeast(version: string): boolean
  initData: string
  initDataUnsafe?: unknown
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export const tg: TelegramWebApp | undefined = window.Telegram?.WebApp

export const isTelegram = Boolean(tg && tg.initData !== undefined)

// CloudStorage доступен с Bot API 6.9
export const hasCloudStorage = Boolean(
  tg?.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9'),
)

export function initTelegram() {
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
    // чтобы свайп по списку не сворачивал Mini App (Bot API 7.7+)
    if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.()
  } catch {
    // не в Telegram — игнорируем
  }
}

export function haptic(type: 'success' | 'error' | 'light' = 'light') {
  try {
    if (!tg?.HapticFeedback) return
    if (type === 'light') tg.HapticFeedback.impactOccurred('light')
    else tg.HapticFeedback.notificationOccurred(type)
  } catch {
    // недоступно — игнорируем
  }
}

export function cloudGetKeys(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    tg!.CloudStorage!.getKeys((err, keys) => (err ? reject(err) : resolve(keys ?? [])))
  })
}

export function cloudGetItems(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return Promise.resolve({})
  return new Promise((resolve, reject) => {
    tg!.CloudStorage!.getItems(keys, (err, values) => (err ? reject(err) : resolve(values ?? {})))
  })
}

export function cloudSetItem(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    tg!.CloudStorage!.setItem(key, value, (err) => (err ? reject(err) : resolve()))
  })
}

export function cloudRemoveItems(keys: string[]): Promise<void> {
  if (keys.length === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    tg!.CloudStorage!.removeItems(keys, (err) => (err ? reject(err) : resolve()))
  })
}
