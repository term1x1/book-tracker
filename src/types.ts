export type BookStatus = 'want' | 'reading' | 'read'

export interface Book {
  id: string
  title: string
  author: string
  status: BookStatus
  /** Оценка 0–5, 0 = без оценки */
  rating: number
  categories: string[]
  notes: string
  /** ISO-дата добавления */
  addedAt: string
  /** ISO-дата завершения чтения (для статуса "read") */
  finishedAt: string | null
  /** URL обложки (OpenLibrary) */
  coverUrl: string | null
  /** Всего страниц */
  totalPages: number | null
  /** Текущая страница (для статуса "reading") */
  currentPage: number | null
}

/** Дополняет книги из старых сохранений новыми полями */
export function normalizeBook(b: Partial<Book> & { id: string; title: string }): Book {
  return {
    author: '',
    status: 'want',
    rating: 0,
    categories: [],
    notes: '',
    addedAt: new Date().toISOString(),
    finishedAt: null,
    coverUrl: null,
    totalPages: null,
    currentPage: null,
    ...b,
  }
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  want: 'Хочу прочитать',
  reading: 'Читаю',
  read: 'Прочитано',
}

export const STATUS_EMOJI: Record<BookStatus, string> = {
  want: '🔖',
  reading: '📖',
  read: '✅',
}

export const DEFAULT_CATEGORIES = [
  'Художественная',
  'Фантастика',
  'Детектив',
  'Нон-фикшн',
  'Психология',
  'Бизнес',
  'История',
  'Биография',
]
