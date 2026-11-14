// Общая база читателей: синхронизация своей библиотеки
// и просмотр чужих. Работает через нашего воркера на Cloudflare.

import type { Book } from './types'
import { normalizeBook } from './types'
import { tg } from './telegram'

const API = 'https://book-tracker-bot.term1x.workers.dev'

export interface Reader {
  id: string
  name: string
  username: string | null
  photo_url: string | null
  read_count: number
  reading_count: number
  want_count: number
}

export interface ReaderProfile {
  user: Pick<Reader, 'id' | 'name' | 'username' | 'photo_url'>
  books: Book[]
}

// Свой Telegram id — чтобы подписать «это вы» в списке
export const myId: string | null = tg?.initDataUnsafe?.user?.id
  ? String(tg.initDataUnsafe.user.id)
  : null

let syncTimer: ReturnType<typeof setTimeout> | null = null

// Отправляем библиотеку в общую базу (заметки не отправляем — они личные).
// Подпись initData подтверждает воркеру, что это действительно вы.
export function syncLibrary(books: Book[]) {
  const initData = tg?.initData
  if (!initData) return // вне Telegram не синхронизируем
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    const payload = books.map(({ notes: _notes, ...rest }) => rest)
    fetch(`${API}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `tma ${initData}`,
      },
      body: JSON.stringify({ books: payload }),
    }).catch(() => {})
  }, 1500)
}

export async function fetchReaders(): Promise<Reader[]> {
  const res = await fetch(`${API}/api/users`)
  if (!res.ok) throw new Error('failed')
  const data = await res.json()
  return data.users ?? []
}

export async function fetchReaderProfile(id: string): Promise<ReaderProfile> {
  const res = await fetch(`${API}/api/user/${id}`)
  if (!res.ok) throw new Error('failed')
  const data = await res.json()
  return { user: data.user, books: (data.books ?? []).map(normalizeBook) }
}
