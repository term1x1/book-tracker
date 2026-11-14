import type { Book } from '../types'
import { STATUS_LABELS } from '../types'
import type { ReactionCounts } from '../social'
import StarRating from './StarRating'
import { STATUS_ICONS, IconChat, IconThumbUp, IconThumbDown } from './Icons'

interface Props {
  book: Book
  onClick: () => void
  onDiscuss?: (book: Book) => void
  reactions?: ReactionCounts
  onReact?: (book: Book, value: 1 | -1) => void
}

export default function BookCard({ book, onClick, onDiscuss, reactions, onReact }: Props) {
  const progress =
    book.status === 'reading' && book.totalPages && book.currentPage
      ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
      : null

  return (
    <div className="book-card" onClick={onClick}>
      {onDiscuss && (
        <button
          className="discuss-btn"
          aria-label="Отзывы о книге"
          onClick={(e) => {
            e.stopPropagation()
            onDiscuss(book)
          }}
        >
          <IconChat size={16} />
        </button>
      )}
      <div className="book-cover" aria-hidden>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" loading="lazy" />
        ) : (
          (() => {
            const Icon = STATUS_ICONS[book.status]
            return <Icon size={26} className="cover-placeholder-icon" />
          })()
        )}
      </div>
      <div className="book-info">
        <div className="book-title">{book.title}</div>
        {book.author && <div className="book-author">{book.author}</div>}
        <div className="book-meta">
          <span className={`status-badge status-${book.status}`}>{STATUS_LABELS[book.status]}</span>
          {book.rating > 0 && <StarRating value={book.rating} />}
        </div>
        {progress !== null && (
          <div className="progress-row">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-label">
              {book.currentPage}/{book.totalPages} · {progress}%
            </span>
          </div>
        )}
        {book.categories.length > 0 && (
          <div className="book-categories">
            {book.categories.map((c) => (
              <span key={c} className="category-chip">{c}</span>
            ))}
          </div>
        )}
        {reactions && (
          <div className="reaction-bar">
            <button
              className={reactions.mine === 1 ? 'react-btn active' : 'react-btn'}
              disabled={!onReact}
              onClick={(e) => {
                e.stopPropagation()
                onReact?.(book, 1)
              }}
              aria-label="Нравится"
            >
              <IconThumbUp size={14} /> {reactions.up}
            </button>
            <button
              className={reactions.mine === -1 ? 'react-btn active down' : 'react-btn'}
              disabled={!onReact}
              onClick={(e) => {
                e.stopPropagation()
                onReact?.(book, -1)
              }}
              aria-label="Не нравится"
            >
              <IconThumbDown size={14} /> {reactions.down}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
