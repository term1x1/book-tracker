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
  points: number
}

// --- рейтинг ---
// Очки: прочитанная книга = 25 + её страницы / 10.
// Формула должна совпадать с SQL в воркере (handleUsers).
export function computePoints(books: Pick<Book, 'status' | 'totalPages'>[]): number {
  let points = 0
  let pages = 0
  for (const b of books) {
    if (b.status !== 'read') continue
    points += 25
    pages += b.totalPages ?? 0
  }
  return points + Math.floor(pages / 10)
}

export interface ReaderLevel {
  emoji: string
  title: string
  min: number
  next: number | null // очков до следующего уровня нет — максимум
}

const LEVELS: Omit<ReaderLevel, 'next'>[] = [
  { emoji: '🌱', title: 'Новичок', min: 0 },
  { emoji: '📖', title: 'Читатель', min: 100 },
  { emoji: '📚', title: 'Книголюб', min: 300 },
  { emoji: '🐛', title: 'Книжный червь', min: 700 },
  { emoji: '🦉', title: 'Магистр чтения', min: 1500 },
  { emoji: '🏆', title: 'Гроссмейстер', min: 3000 },
]

export function levelFor(points: number): ReaderLevel {
  let i = 0
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++
  return { ...LEVELS[i], next: i + 1 < LEVELS.length ? LEVELS[i + 1].min : null }
}

export interface ReaderProfile {
  user: Pick<Reader, 'id' | 'name' | 'username' | 'photo_url'>
  books: Book[]
}

// Свой Telegram id — чтобы подписать «это вы» в списке
export const myId: string | null = tg?.initDataUnsafe?.user?.id
  ? String(tg.initDataUnsafe.user.id)
  : null

// Данные своего профиля из Telegram
export const myProfile = {
  name:
    [tg?.initDataUnsafe?.user?.first_name, tg?.initDataUnsafe?.user?.last_name]
      .filter(Boolean)
      .join(' ') || 'Читатель',
  username: tg?.initDataUnsafe?.user?.username ?? null,
  photo: tg?.initDataUnsafe?.user?.photo_url ?? null,
}

// --- друзья ---
function authHeaders(): Record<string, string> {
  return tg?.initData ? { Authorization: `tma ${tg.initData}` } : {}
}

export async function fetchFriends(): Promise<string[]> {
  if (!tg?.initData) return []
  const res = await fetch(`${API}/api/friends`, { headers: authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.friends ?? []
}

export async function toggleFriend(friendId: string): Promise<string[] | null> {
  if (!tg?.initData) return null
  const res = await fetch(`${API}/api/friends/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ friend_id: friendId }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.friends ?? []
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

// Отправляем библиотеку в общую базу (заметки не отправляем — они личные).
// Подпись initData подтверждает воркеру, что это действительно вы.
export function syncLibrary(books: Book[]) {
  const initData = tg?.initData
  if (!initData) return // вне Telegram не синхронизируем
  if (syncTimer) clearTimeout(syncTimer)
  // короткая задержка, чтобы серия правок ушла одним запросом,
  // но успела отправиться до закрытия приложения
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
  }, 600)
}

export async function fetchReaders(): Promise<Reader[]> {
  const res = await fetch(`${API}/api/users`)
  if (!res.ok) throw new Error('failed')
  const data = await res.json()
  return data.users ?? []
}

// --- отзывы и обсуждения ---
// Ключ обсуждения: одна и та же книга у разных людей = одна дискуссия
export function bookKey(title: string, author: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${norm(title)}|${norm(author)}`
}

export interface BookComment {
  id: string
  text: string
  created_at: string
  user: { id: string; name: string; username: string | null; photo_url: string | null }
}

export async function fetchComments(key: string): Promise<BookComment[]> {
  const res = await fetch(`${API}/api/comments?key=${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error('failed')
  const data = await res.json()
  return data.comments ?? []
}

export async function addComment(key: string, text: string): Promise<boolean> {
  if (!tg?.initData) return false
  const res = await fetch(`${API}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ book_key: key, text }),
  })
  return res.ok
}

export async function deleteComment(id: string): Promise<boolean> {
  if (!tg?.initData) return false
  const res = await fetch(`${API}/api/comments/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ id }),
  })
  return res.ok
}

export async function fetchReaderProfile(id: string): Promise<ReaderProfile> {
  const res = await fetch(`${API}/api/user/${id}`)
  if (!res.ok) throw new Error('failed')
  const data = await res.json()
  return { user: data.user, books: (data.books ?? []).map(normalizeBook) }
}
