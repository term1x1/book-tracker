// Дневник чтения: сколько страниц прочитано в каждый день.
// Считается автоматически из правок прогресса, хранится локально
// и в облаке Telegram (ключ reading_log), при расхождении берём максимум.

import { hasCloudStorage, cloudGetItems, cloudSetItem } from './telegram'

export type ReadingLog = Record<string, number> // '2026-11-15' -> страниц

const LS_KEY = 'book-tracker:reading-log'
const CLOUD_KEY = 'reading_log'
const KEEP_DAYS = 92 // храним ~3 месяца, чтобы влезать в лимиты облака
const DAY_CAP = 5000

let log: ReadingLog = {}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// локальная дата пользователя, не UTC — день должен совпадать с его сутками
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function prune() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS)
  const min = dateKey(cutoff)
  for (const k of Object.keys(log)) {
    if (k < min) delete log[k]
  }
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(log))
  } catch {
    // квота — игнорируем
  }
  if (hasCloudStorage) {
    cloudSetItem(CLOUD_KEY, JSON.stringify(log)).catch(() => {})
  }
}

export async function initReadingLog(): Promise<ReadingLog> {
  try {
    log = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as ReadingLog
  } catch {
    log = {}
  }
  if (hasCloudStorage) {
    try {
      const values = await cloudGetItems([CLOUD_KEY])
      const cloud = JSON.parse(values[CLOUD_KEY] ?? '{}') as ReadingLog
      for (const [k, v] of Object.entries(cloud)) {
        const n = Number(v) || 0
        log[k] = Math.max(log[k] ?? 0, n)
      }
    } catch {
      // облако недоступно — работаем с локальной копией
    }
  }
  prune()
  persist()
  return { ...log }
}

export function getReadingLog(): ReadingLog {
  return { ...log }
}

// Засчитать прочитанные сегодня страницы
export function recordPages(delta: number): ReadingLog {
  if (!Number.isFinite(delta) || delta <= 0) return { ...log }
  const k = dateKey(new Date())
  log[k] = Math.min(DAY_CAP, (log[k] ?? 0) + Math.round(delta))
  prune()
  persist()
  return { ...log }
}
