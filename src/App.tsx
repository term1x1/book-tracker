import { useEffect, useMemo, useState } from 'react'
import type { Book, BookStatus } from './types'
import { STATUS_LABELS } from './types'
import { loadBooks, saveBooks } from './storage'
import { haptic, canAddToHomeScreen, addToHomeScreen, pingStats } from './telegram'
import BookCard from './components/BookCard'
import BookForm from './components/BookForm'
import Profile from './components/Profile'
import Readers from './components/Readers'
import BookDiscussion from './components/BookDiscussion'
import { syncLibrary } from './social'
import { checkForUpdate } from './version'

type Tab = 'library' | 'readers' | 'profile'
type StatusFilter = BookStatus | 'all'

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('library')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Book | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [discussing, setDiscussing] = useState<Book | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  // Автообновление: проверяем версию при старте, при возврате в приложение
  // и раз в 5 минут — чтобы никто не застревал на старой сборке
  useEffect(() => {
    const check = () => checkForUpdate().then((u) => u && setUpdateReady(true))
    check()
    const timer = setInterval(check, 5 * 60 * 1000)
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    loadBooks()
      .then((loaded) => {
        setBooks(loaded)
        // пустую библиотеку при старте не отправляем: если облако
        // не ответило, это не повод стереть копию в общей базе
        if (loaded.length > 0) syncLibrary(loaded)
      })
      .finally(() => setLoading(false))
    pingStats()
  }, [])

  const persist = (next: Book[]) => {
    setBooks(next)
    saveBooks(next).catch((e) => console.error('save failed', e))
    syncLibrary(next)
  }

  const handleSave = (book: Book) => {
    const exists = books.some((b) => b.id === book.id)
    persist(exists ? books.map((b) => (b.id === book.id ? book : b)) : [book, ...books])
    haptic('success')
    setShowForm(false)
    setEditing(null)
  }

  const handleDelete = (id: string) => {
    persist(books.filter((b) => b.id !== id))
    haptic('error')
    setShowForm(false)
    setEditing(null)
  }

  const knownCategories = useMemo(
    () => Array.from(new Set(books.flatMap((b) => b.categories))),
    [books],
  )

  // Фильтр по категории, которой больше нет (книгу изменили/удалили), сбрасывается
  useEffect(() => {
    if (categoryFilter && !knownCategories.includes(categoryFilter)) {
      setCategoryFilter(null)
    }
  }, [categoryFilter, knownCategories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return books.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (categoryFilter && !b.categories.includes(categoryFilter)) return false
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false
      return true
    })
  }, [books, statusFilter, categoryFilter, search])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: books.length, want: 0, reading: 0, read: 0 }
    for (const b of books) c[b.status]++
    return c
  }, [books])

  if (loading) {
    return <div className="loading">Загрузка…</div>
  }

  return (
    <div className="app">
      {updateReady && (
        <button className="update-banner" onClick={() => location.reload()}>
          🚀 Вышло обновление — нажмите, чтобы применить
        </button>
      )}
      <header className="header">
        <h1>
          <img src="./logo.png" alt="" className="app-logo" />
          Мои книги
          {canAddToHomeScreen && (
            <button
              className="home-screen-btn"
              onClick={addToHomeScreen}
              title="Добавить на главный экран"
              aria-label="Добавить на главный экран"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
              На экран
            </button>
          )}
        </h1>
        <div className="tabs">
          <button className={tab === 'library' ? 'tab active' : 'tab'} onClick={() => setTab('library')}>
            Библиотека
          </button>
          <button className={tab === 'readers' ? 'tab active' : 'tab'} onClick={() => setTab('readers')}>
            Читатели
          </button>
          <button className={tab === 'profile' ? 'tab active' : 'tab'} onClick={() => setTab('profile')}>
            Профиль
          </button>
        </div>
      </header>

      {tab === 'library' ? (
        <>
          <div className="toolbar">
            <input
              className="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или автору"
              type="search"
            />
            <div className="filter-chips">
              {(['all', 'reading', 'read', 'want'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  className={statusFilter === s ? 'chip active' : 'chip'}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'Все' : STATUS_LABELS[s]} · {counts[s]}
                </button>
              ))}
            </div>
            {knownCategories.length > 0 && (
              <div className="filter-chips">
                {knownCategories.map((c) => (
                  <button
                    key={c}
                    className={categoryFilter === c ? 'chip small active' : 'chip small'}
                    onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="book-list">
            {filtered.length === 0 ? (
              <p className="empty-hint">
                {books.length === 0
                  ? 'Библиотека пуста. Нажмите «+», чтобы добавить первую книгу!'
                  : 'Ничего не найдено по заданным фильтрам.'}
              </p>
            ) : (
              filtered.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  onClick={() => {
                    setEditing(b)
                    setShowForm(true)
                  }}
                  onDiscuss={setDiscussing}
                />
              ))
            )}
          </div>

          <button
            className="fab"
            aria-label="Добавить книгу"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            +
          </button>
        </>
      ) : tab === 'readers' ? (
        <Readers />
      ) : (
        <Profile books={books} />
      )}

      {discussing && (
        <BookDiscussion
          title={discussing.title}
          author={discussing.author}
          onClose={() => setDiscussing(null)}
        />
      )}

      {showForm && (
        <BookForm
          book={editing}
          knownCategories={knownCategories}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
