// Достижения: считаются на лету из библиотеки, ничего не нужно хранить.
// value(books) — текущее значение, target — сколько нужно для открытия.

import type { Book } from './types'

export interface Achievement {
  id: string
  emoji: string
  title: string
  desc: string
  target: number
  value: (books: Book[]) => number
}

const read = (books: Book[]) => books.filter((b) => b.status === 'read')
const pagesRead = (books: Book[]) => read(books).reduce((s, b) => s + (b.totalPages ?? 0), 0)
const rated = (books: Book[]) => read(books).filter((b) => b.rating > 0)
const categories = (books: Book[]) => new Set(books.flatMap((b) => b.categories)).size

export const ACHIEVEMENTS: Achievement[] = [
  // прочитанные книги
  { id: 'read1', emoji: '📕', title: 'Первая книга', desc: 'Прочитать первую книгу', target: 1, value: (b) => read(b).length },
  { id: 'read5', emoji: '📗', title: 'Пятёрка', desc: 'Прочитать 5 книг', target: 5, value: (b) => read(b).length },
  { id: 'read10', emoji: '📘', title: 'Десятка', desc: 'Прочитать 10 книг', target: 10, value: (b) => read(b).length },
  { id: 'read25', emoji: '📚', title: 'Четверть сотни', desc: 'Прочитать 25 книг', target: 25, value: (b) => read(b).length },
  { id: 'read50', emoji: '🏛', title: 'Полсотни', desc: 'Прочитать 50 книг', target: 50, value: (b) => read(b).length },
  { id: 'read100', emoji: '👑', title: 'Сотня', desc: 'Прочитать 100 книг', target: 100, value: (b) => read(b).length },
  // страницы
  { id: 'pages500', emoji: '📄', title: 'Разгон', desc: 'Прочитать 500 страниц', target: 500, value: pagesRead },
  { id: 'pages2000', emoji: '📑', title: 'В потоке', desc: 'Прочитать 2 000 страниц', target: 2000, value: pagesRead },
  { id: 'pages5000', emoji: '🗞', title: 'Стопка томов', desc: 'Прочитать 5 000 страниц', target: 5000, value: pagesRead },
  { id: 'pages10000', emoji: '📜', title: 'Десять тысяч', desc: 'Прочитать 10 000 страниц', target: 10000, value: pagesRead },
  { id: 'pages25000', emoji: '🏔', title: 'Эверест', desc: 'Прочитать 25 000 страниц', target: 25000, value: pagesRead },
  { id: 'brick', emoji: '🧱', title: 'Кирпич', desc: 'Осилить книгу от 500 страниц', target: 1, value: (b) => read(b).filter((x) => (x.totalPages ?? 0) >= 500).length },
  // оценки
  { id: 'rate1', emoji: '⭐', title: 'Первая оценка', desc: 'Оценить прочитанную книгу', target: 1, value: (b) => rated(b).length },
  { id: 'rate10', emoji: '🌟', title: 'Критик', desc: 'Оценить 10 книг', target: 10, value: (b) => rated(b).length },
  { id: 'strict', emoji: '💔', title: 'Строгий судья', desc: 'Поставить оценку 1–2', target: 1, value: (b) => read(b).filter((x) => x.rating >= 1 && x.rating <= 2).length },
  { id: 'perfect', emoji: '💎', title: 'Идеал найден', desc: 'Поставить пять звёзд', target: 1, value: (b) => read(b).filter((x) => x.rating === 5).length },
  // разнообразие
  { id: 'cat3', emoji: '🎨', title: 'Разносторонний', desc: 'Книги из 3 категорий', target: 3, value: categories },
  { id: 'cat5', emoji: '🌈', title: 'Эрудит', desc: 'Книги из 5 категорий', target: 5, value: categories },
  // библиотека
  { id: 'lib10', emoji: '🗂', title: 'Коллекционер', desc: '10 книг в библиотеке', target: 10, value: (b) => b.length },
  { id: 'lib30', emoji: '🏰', title: 'Библиотекарь', desc: '30 книг в библиотеке', target: 30, value: (b) => b.length },
  { id: 'want10', emoji: '🔖', title: 'Мечтатель', desc: '10 книг в планах', target: 10, value: (b) => b.filter((x) => x.status === 'want').length },
  { id: 'multi3', emoji: '🔥', title: 'Многостаночник', desc: 'Читать 3 книги сразу', target: 3, value: (b) => b.filter((x) => x.status === 'reading').length },
  // привычки
  { id: 'notes5', emoji: '✍️', title: 'Летописец', desc: 'Заметки к 5 книгам', target: 5, value: (b) => b.filter((x) => x.notes.trim().length > 0).length },
  { id: 'photo', emoji: '📷', title: 'Фотограф', desc: 'Добавить свою обложку', target: 1, value: (b) => b.filter((x) => x.coverUrl?.startsWith('data:')).length },
  { id: 'year10', emoji: '🚀', title: 'Годовой забег', desc: '10 книг за этот год', target: 10, value: (b) => read(b).filter((x) => x.finishedAt && new Date(x.finishedAt).getFullYear() === new Date().getFullYear()).length },
]

export function unlockedCount(books: Book[]): number {
  return ACHIEVEMENTS.filter((a) => a.value(books) >= a.target).length
}
