import { useEffect, useState } from 'react'
import type { Book, BookStatus } from '../types'
import { STATUS_LABELS } from '../types'
import type { Reader, ReaderProfile } from '../social'
import {
  fetchReaders,
  fetchReaderProfile,
  fetchFriends,
  toggleFriend,
  myId,
  computePoints,
  levelFor,
} from '../social'
import { haptic } from '../telegram'
import BookCard from './BookCard'

const MEDALS = ['🥇', '🥈', '🥉']

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
  const [search, setSearch] = useState('')
  const [friends, setFriends] = useState<string[]>([])

  useEffect(() => {
    fetchReaders()
      .then(setReaders)
      .catch(() => setError(true))
    fetchFriends().then(setFriends).catch(() => {})
  }, [])

  const handleToggleFriend = async (id: string) => {
    haptic('light')
    // мгновенный отклик, потом сверяемся с сервером
    setFriends((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
    const fresh = await toggleFriend(id)
    if (fresh) setFriends(fresh)
  }

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
    const points = computePoints(books)
    const level = levelFor(points)
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
          <div className="reader-head-info">
            <h2 className="reader-name">
              {user.name}
              {user.id === myId && <span className="you-badge">это вы</span>}
            </h2>
            {user.username && <div className="reader-username">@{user.username}</div>}
            <div className="reader-level">
              {level.emoji} {level.title} · ⭐ {points}
            </div>
          </div>
          {myId && user.id !== myId && (
            <button
              className={friends.includes(user.id) ? 'friend-btn active' : 'friend-btn'}
              onClick={() => handleToggleFriend(user.id)}
            >
              {friends.includes(user.id) ? '✓ В друзьях' : '+ В друзья'}
            </button>
          )}
        </div>
        {level.next !== null && (
          <div className="level-progress">
            <div className="level-progress-bar">
              <div
                className="level-progress-fill"
                style={{ width: `${Math.min(100, Math.round(((points - level.min) / (level.next - level.min)) * 100))}%` }}
              />
            </div>
            <span className="level-progress-hint">
              до «{levelFor(level.next).title}» ещё {level.next - points} очков
            </span>
          </div>
        )}
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

  const q = search.trim().toLowerCase().replace(/^@/, '')
  const matches = (r: Reader) =>
    !q || r.name.toLowerCase().includes(q) || (r.username ?? '').toLowerCase().includes(q)
  const friendRows = readers.filter((r) => friends.includes(r.id) && matches(r))
  const otherRows = readers.filter((r) => !friends.includes(r.id) && matches(r))

  const renderRow = (r: Reader) => {
    const rank = readers.findIndex((x) => x.id === r.id)
    const level = levelFor(r.points)
    return (
      <button key={r.id} className="reader-row" onClick={() => openProfile(r.id)}>
        <span className="reader-rank">{MEDALS[rank] ?? rank + 1}</span>
        <Avatar name={r.name} photo={r.photo_url} />
        <span className="reader-row-text">
          <span className="reader-row-name">
            {r.name}
            {r.id === myId && <span className="you-badge">это вы</span>}
          </span>
          <span className="reader-row-stats">
            {level.emoji} {level.title} · ✅ {r.read_count} · 📖 {r.reading_count} · 🔖 {r.want_count}
          </span>
        </span>
        <span className="reader-points">⭐ {r.points}</span>
      </button>
    )
  }

  return (
    <div className="readers">
      <input
        className="search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по имени или @нику"
      />
      {friendRows.length > 0 && (
        <>
          <h3 className="readers-section-title">Друзья</h3>
          <div className="readers-list">{friendRows.map(renderRow)}</div>
        </>
      )}
      {otherRows.length > 0 && (
        <>
          {friendRows.length > 0 && <h3 className="readers-section-title">Все читатели</h3>}
          <div className="readers-list">{otherRows.map(renderRow)}</div>
        </>
      )}
      {friendRows.length === 0 && otherRows.length === 0 && (
        <p className="empty-hint">Никого не нашлось по запросу «{search}».</p>
      )}
    </div>
  )
}
