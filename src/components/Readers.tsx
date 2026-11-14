import { useEffect, useState } from 'react'
import type { Book, BookStatus } from '../types'
import { STATUS_LABELS } from '../types'
import type { Reader, ReaderProfile } from '../social'
import { fetchReaders, fetchReaderProfile, myId } from '../social'
import BookCard from './BookCard'

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) return <img className="reader-avatar" src={photo} alt="" />
  return <div className="reader-avatar reader-avatar-letter">{name.trim().charAt(0).toUpperCase() || '📖'}</div>
}

export default function Readers() {
  const [readers, setReaders] = useState<Reader[] | null>(null)
  const [error, setError] = useState(false)
  const [profile, setProfile] = useState<ReaderProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all')

  useEffect(() => {
    fetchReaders()
      .then(setReaders)
      .catch(() => setError(true))
  }, [])

  const openProfile = async (id: string) => {
    setProfileLoading(true)
    setStatusFilter('all')
    try {
      setProfile(await fetchReaderProfile(id))
    } catch {
      setError(true)
    } finally {
      setProfileLoading(false)
    }
  }

  if (error) {
    return <p className="empty-hint">Не удалось загрузить читателей. Проверьте интернет и попробуйте ещё раз.</p>
  }

  // --- профиль читателя ---
  if (profile) {
    const { user, books } = profile
    const counts: Record<BookStatus | 'all', number> = {
      all: books.length,
      want: books.filter((b) => b.status === 'want').length,
      reading: books.filter((b) => b.status === 'reading').length,
      read: books.filter((b) => b.status === 'read').length,
    }
    const shown = statusFilter === 'all' ? books : books.filter((b) => b.status === statusFilter)
    return (
      <div className="reader-profile">
        <button className="back-btn" onClick={() => setProfile(null)}>← Все читатели</button>
        <div className="reader-head">
          <Avatar name={user.name} photo={user.photo_url} />
          <div>
            <h2 className="reader-name">
              {user.name}
              {user.id === myId && <span className="you-badge">это вы</span>}
            </h2>
            {user.username && <div className="reader-username">@{user.username}</div>}
          </div>
        </div>
        <div className="filter-chips">
          {(['all', 'reading', 'read', 'want'] as (BookStatus | 'all')[]).map((s) => (
            <button
              key={s}
              className={statusFilter === s ? 'chip active' : 'chip'}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Все' : STATUS_LABELS[s]} · {counts[s]}
            </button>
          ))}
        </div>
        <div className="book-list">
          {shown.length === 0 ? (
            <p className="empty-hint">Здесь пока пусто.</p>
          ) : (
            shown.map((b: Book) => <BookCard key={b.id} book={b} onClick={() => {}} />)
          )}
        </div>
      </div>
    )
  }

  // --- список читателей ---
  if (readers === null || profileLoading) {
    return <p className="empty-hint">Загрузка…</p>
  }
  if (readers.length === 0) {
    return <p className="empty-hint">Пока никого нет. Вы станете первым — добавьте книгу!</p>
  }
  return (
    <div className="readers-list">
      {readers.map((r) => (
        <button key={r.id} className="reader-row" onClick={() => openProfile(r.id)}>
          <Avatar name={r.name} photo={r.photo_url} />
          <span className="reader-row-text">
            <span className="reader-row-name">
              {r.name}
              {r.id === myId && <span className="you-badge">это вы</span>}
            </span>
            <span className="reader-row-stats">
              ✅ {r.read_count} прочитано · 📖 {r.reading_count} читает · 🔖 {r.want_count} в планах
            </span>
          </span>
          <span className="reader-row-arrow">›</span>
        </button>
      ))}
    </div>
  )
}
