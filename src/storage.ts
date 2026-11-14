import type { Book } from './types'
import { normalizeBook } from './types'
import {
  hasCloudStorage,
  cloudGetItems,
  cloudGetKeys,
  cloudSetItem,
  cloudRemoveItems,
} from './telegram'

// Telegram CloudStorage ограничивает значение ключа 4096 символами,
// поэтому список книг режется на чанки books_0, books_1, ...
// books_meta хранит число чанков и время сохранения.
//
// Обе копии (облако и localStorage) несут метку времени: при загрузке
// побеждает более свежая. Так правка не откатывается, если запись
// в облако сорвалась — локальная копия новее, и облако «чинится» по ней.

const LS_KEY = 'book-tracker:books'
const LS_TIME_KEY = 'book-tracker:savedAt'
const CHUNK_PREFIX = 'books_'
const META_KEY = 'books_meta'
const CHUNK_SIZE = 3800 // запас от лимита 4096

export async function loadBooks(): Promise<Book[]> {
  const local = loadFromLocal()
  if (!hasCloudStorage) {
    return local.books.map(normalizeBook)
  }

  let cloudBooks: Book[] | null = null
  let cloudSavedAt = 0
  try {
    const cloud = await loadFromCloud()
    cloudBooks = cloud.books
    cloudSavedAt = cloud.savedAt
  } catch (e) {
    console.error('CloudStorage load failed, falling back to localStorage', e)
  }

  // локальная копия свежее облачной — прошлая запись в облако сорвалась
  if (local.books.length > 0 && local.savedAt > cloudSavedAt) {
    void saveBooks(local.books) // чиним облако
    return local.books.map(normalizeBook)
  }
  if (cloudBooks !== null) {
    return cloudBooks.map(normalizeBook)
  }
  return local.books.map(normalizeBook)
}

// Очередь записи: два быстрых сохранения подряд не перемешивают чанки в облаке
let saveQueue: Promise<void> = Promise.resolve()

export function saveBooks(books: Book[]): Promise<void> {
  const savedAt = Date.now()
  // localStorage всегда пишем как резервную копию
  saveToLocal(books, savedAt)
  if (hasCloudStorage) {
    saveQueue = saveQueue.catch(() => {}).then(() => saveToCloud(books, savedAt))
    return saveQueue
  }
  return Promise.resolve()
}

function loadFromLocal(): { books: Book[]; savedAt: number } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const savedAt = parseInt(localStorage.getItem(LS_TIME_KEY) ?? '0', 10) || 0
    if (!raw) return { books: [], savedAt: 0 }
    return { books: JSON.parse(raw) as Book[], savedAt }
  } catch {
    return { books: [], savedAt: 0 }
  }
}

function saveToLocal(books: Book[], savedAt: number) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(books))
    localStorage.setItem(LS_TIME_KEY, String(savedAt))
  } catch {
    // квота/приватный режим — игнорируем
  }
}

// meta: новый формат '{"n":3,"t":169...}', старый — просто число чанков
function parseMeta(raw: string | undefined): { count: number; savedAt: number } {
  if (!raw) return { count: 0, savedAt: 0 }
  try {
    if (raw.startsWith('{')) {
      const m = JSON.parse(raw)
      return { count: Number(m.n) || 0, savedAt: Number(m.t) || 0 }
    }
  } catch {
    return { count: 0, savedAt: 0 }
  }
  return { count: parseInt(raw, 10) || 0, savedAt: 0 }
}

async function loadFromCloud(): Promise<{ books: Book[] | null; savedAt: number }> {
  const meta = await cloudGetItems([META_KEY])
  const { count, savedAt } = parseMeta(meta[META_KEY])
  if (!count) return { books: null, savedAt: 0 }
  const keys = Array.from({ length: count }, (_, i) => `${CHUNK_PREFIX}${i}`)
  const values = await cloudGetItems(keys)
  const json = keys.map((k) => values[k] ?? '').join('')
  if (!json) return { books: [], savedAt }
  return { books: JSON.parse(json) as Book[], savedAt }
}

// Запись с одним повтором: CloudStorage иногда отваливается на лимитах
async function setWithRetry(key: string, value: string): Promise<void> {
  try {
    await cloudSetItem(key, value)
  } catch {
    await new Promise((r) => setTimeout(r, 900))
    await cloudSetItem(key, value)
  }
}

async function saveToCloud(books: Book[], savedAt: number): Promise<void> {
  const json = JSON.stringify(books)
  const chunks: string[] = []
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push(json.slice(i, i + CHUNK_SIZE))
  }
  if (chunks.length === 0) chunks.push('[]')

  // записываем новые чанки; meta — последней, как «подпись»,
  // что запись дошла целиком
  for (let i = 0; i < chunks.length; i++) {
    await setWithRetry(`${CHUNK_PREFIX}${i}`, chunks[i])
  }
  await setWithRetry(META_KEY, JSON.stringify({ n: chunks.length, t: savedAt }))

  // удаляем лишние старые чанки
  try {
    const allKeys = await cloudGetKeys()
    const stale = allKeys.filter((k) => {
      if (!k.startsWith(CHUNK_PREFIX)) return false
      const idx = parseInt(k.slice(CHUNK_PREFIX.length), 10)
      return !Number.isNaN(idx) && idx >= chunks.length
    })
    await cloudRemoveItems(stale)
  } catch {
    // не критично
  }
}
