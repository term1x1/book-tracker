import type { Book } from '../types'
import { STATUS_EMOJI, STATUS_LABELS } from '../types'
import StarRating from './StarRating'

interface Props {
  book: Book
  onClick: () => void
  onDiscuss?: (book: Book) => void
}

export default function BookCard({ book, onClick, onDiscuss }: Props) {
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
          💬
        </button>
      )}
      <div className="book-cover" aria-hidden>
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" loading="lazy" />
        ) : (
          STATUS_EMOJI[book.status]
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
      </div>
    </div>
  )
}
