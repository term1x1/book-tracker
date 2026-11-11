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
// books_meta хранит число чанков.

const LS_KEY = 'book-tracker:books'
const CHUNK_PREFIX = 'books_'
const META_KEY = 'books_meta'
const CHUNK_SIZE = 3800 // запас от лимита 4096

export async function loadBooks(): Promise<Book[]> {
  let books: Book[]
  if (hasCloudStorage) {
    try {
      books = await loadFromCloud()
    } catch (e) {
      console.error('CloudStorage load failed, falling back to localStorage', e)
      books = loadFromLocal()
    }
  } else {
    books = loadFromLocal()
  }
  return books.map(normalizeBook)
}

// Очередь записи: два быстрых сохранения подряд не перемешивают чанки в облаке
let saveQueue: Promise<void> = Promise.resolve()

export function saveBooks(books: Book[]): Promise<void> {
  // localStorage всегда пишем как резервную копию
  saveToLocal(books)
  if (hasCloudStorage) {
    saveQueue = saveQueue.catch(() => {}).then(() => saveToCloud(books))
    return saveQueue
  }
  return Promise.resolve()
}

function loadFromLocal(): Book[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Book[]
  } catch {
    return []
  }
}

function saveToLocal(books: Book[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(books))
  } catch {
    // квота/приватный режим — игнорируем
  }
}

async function loadFromCloud(): Promise<Book[]> {
  const meta = await cloudGetItems([META_KEY])
  const count = parseInt(meta[META_KEY] ?? '0', 10)
  if (!count || Number.isNaN(count)) return loadFromLocal()
  const keys = Array.from({ length: count }, (_, i) => `${CHUNK_PREFIX}${i}`)
  const values = await cloudGetItems(keys)
  const json = keys.map((k) => values[k] ?? '').join('')
  if (!json) return []
  return JSON.parse(json) as Book[]
}

async function saveToCloud(books: Book[]): Promise<void> {
  const json = JSON.stringify(books)
  const chunks: string[] = []
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks.push(json.slice(i, i + CHUNK_SIZE))
  }
  if (chunks.length === 0) chunks.push('[]')

  // записываем новые чанки
  for (let i = 0; i < chunks.length; i++) {
    await cloudSetItem(`${CHUNK_PREFIX}${i}`, chunks[i])
  }
  await cloudSetItem(META_KEY, String(chunks.length))

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
