import { useEffect, useRef, useState } from 'react'
import type { Book, BookStatus } from '../types'
import { STATUS_LABELS, DEFAULT_CATEGORIES } from '../types'
import type { BookSuggestion } from '../api'
import { searchBooks } from '../api'
import StarRating from './StarRating'

interface Props {
  book: Book | null // null = новая книга
  knownCategories: string[]
  onSave: (book: Book) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export default function BookForm({ book, knownCategories, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [status, setStatus] = useState<BookStatus>(book?.status ?? 'want')
  const [rating, setRating] = useState(book?.rating ?? 0)
  const [categories, setCategories] = useState<string[]>(book?.categories ?? [])
  const [notes, setNotes] = useState(book?.notes ?? '')
  const [coverUrl, setCoverUrl] = useState<string | null>(book?.coverUrl ?? null)
  const [totalPages, setTotalPages] = useState<string>(book?.totalPages ? String(book.totalPages) : '')
  const [currentPage, setCurrentPage] = useState<string>(book?.currentPage ? String(book.currentPage) : '')
  const [newCategory, setNewCategory] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // --- автозаполнение ---
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Пока открыта модалка — фон не прокручивается
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  // «Принятое» название, для которого искать не нужно:
  // то, с которым открыли форму, или только что выбранное из подсказок
  const acceptedTitleRef = useRef(book?.title ?? '')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (title === acceptedTitleRef.current) {
      setShowSuggestions(false)
      return
    }
    const q = title.trim()
    if (q.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setSearching(true)
      try {
        const results = await searchBooks(q, ctrl.signal)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      } catch {
        // сеть/отмена — молча игнорируем
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [title])

  const pickSuggestion = (s: BookSuggestion) => {
    acceptedTitleRef.current = s.title
    setTitle(s.title)
    if (s.author) setAuthor(s.author)
    if (s.coverUrl) setCoverUrl(s.coverUrl)
    if (s.totalPages) setTotalPages(String(s.totalPages))
    setShowSuggestions(false)
    setSuggestions([])
  }

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...knownCategories, ...categories]))

  const toggleCategory = (c: string) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const addCategory = () => {
    const c = newCategory.trim()
    if (!c) return
    if (!categories.includes(c)) setCategories((prev) => [...prev, c])
    setNewCategory('')
  }

  const parsePages = (v: string): number | null => {
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const handleSave = () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    const total = parsePages(totalPages)
    let current = status === 'reading' ? parsePages(currentPage) : null
    // текущая страница не может быть больше общего числа страниц
    if (current !== null && total !== null && current > total) current = total
    onSave({
      id: book?.id ?? crypto.randomUUID(),
      title: title.trim(),
      author: author.trim(),
      status,
      rating,
      categories,
      notes: notes.trim(),
      addedAt: book?.addedAt ?? now,
      finishedAt:
        status === 'read' ? (book?.status === 'read' && book.finishedAt ? book.finishedAt : now) : null,
      coverUrl,
      totalPages: total,
      currentPage: current,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{book ? 'Редактировать' : 'Новая книга'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="form-top">
          {coverUrl && (
            <div className="cover-preview">
              <img src={coverUrl} alt="Обложка" />
              <button className="cover-remove" onClick={() => setCoverUrl(null)} aria-label="Убрать обложку">✕</button>
            </div>
          )}
          <div className="form-top-fields">
            <label className="field autocomplete">
              <span>Название * {searching && <em className="searching">ищу…</em>}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => e.key === 'Escape' && setShowSuggestions(false)}
                placeholder="Название (можно с автором)…"
                autoFocus={!book}
              />
              {showSuggestions && (
                // preventDefault на mousedown: иначе blur поля закрывает список
                // раньше, чем успевает сработать клик по подсказке
                <div className="suggestions" onMouseDown={(e) => e.preventDefault()}>
                  {suggestions.map((s, i) => (
                    <button key={i} className="suggestion" onClick={() => pickSuggestion(s)}>
                      {s.coverUrl ? (
                        <img src={s.coverUrl.replace('-M.jpg', '-S.jpg')} alt="" />
                      ) : (
                        <span className="suggestion-no-cover">📕</span>
                      )}
                      <span className="suggestion-text">
                        <span className="suggestion-title">{s.title}</span>
                        <span className="suggestion-author">
                          {s.author}{s.year ? ` · ${s.year}` : ''}
                        </span>
                      </span>
                    </button>
                  ))}
                  <button
                    className="suggestion suggestion-manual"
                    onClick={() => {
                      setShowSuggestions(false)
                      setSuggestions([])
                    }}
                  >
                    ✍️ Моей книги здесь нет — заполню вручную
                  </button>
                </div>
              )}
            </label>

            <label className="field">
              <span>Автор</span>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="М. Булгаков" />
            </label>
          </div>
        </div>

        <div className="field">
          <span>Статус</span>
          <div className="segment">
            {(Object.keys(STATUS_LABELS) as BookStatus[]).map((s) => (
              <button
                key={s}
                className={status === s ? 'segment-btn active' : 'segment-btn'}
                onClick={() => setStatus(s)}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="pages-row">
          {status === 'reading' && (
            <label className="field">
              <span>Текущая страница</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={currentPage}
                onChange={(e) => setCurrentPage(e.target.value)}
                placeholder="120"
              />
            </label>
          )}
          <label className="field">
            <span>Всего страниц</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={totalPages}
              onChange={(e) => setTotalPages(e.target.value)}
              placeholder="480"
            />
          </label>
        </div>

        <div className="field">
          <span>Оценка</span>
          <StarRating value={rating} onChange={setRating} size="large" />
        </div>

        <div className="field">
          <span>Категории</span>
          <div className="category-picker">
            {allCategories.map((c) => (
              <button
                key={c}
                className={categories.includes(c) ? 'category-chip selectable selected' : 'category-chip selectable'}
                onClick={() => toggleCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="add-category">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="Своя категория…"
            />
            <button className="btn secondary" onClick={addCategory}>+</button>
          </div>
        </div>

        <label className="field">
          <span>Заметки</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Впечатления, цитаты…" />
        </label>

        <div className="modal-actions">
          {book && onDelete && (
            confirmDelete ? (
              <button className="btn danger" onClick={() => onDelete(book.id)}>Точно удалить?</button>
            ) : (
              <button className="btn danger-outline" onClick={() => setConfirmDelete(true)}>Удалить</button>
            )
          )}
          <button className="btn primary" onClick={handleSave} disabled={!title.trim()}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
