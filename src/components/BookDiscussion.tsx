import { useEffect, useRef, useState } from 'react'
import type { BookComment } from '../social'
import { bookKey, fetchComments, addComment, deleteComment, myId } from '../social'
import { haptic } from '../telegram'
import { IconChat, IconSend } from './Icons'

interface Props {
  title: string
  author: string
  onClose: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `сегодня в ${time}`
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${time}`
}

// Окно отзывов: одна дискуссия на книгу, общая для всех читателей
export default function BookDiscussion({ title, author, onClose }: Props) {
  const key = bookKey(title, author)
  const [comments, setComments] = useState<BookComment[] | null>(null)
  const [error, setError] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  const load = () =>
    fetchComments(key)
      .then((c) => {
        setComments(c)
        setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50)
      })
      .catch(() => setError(true))

  useEffect(() => {
    load()
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    const ok = await addComment(key, t)
    setSending(false)
    if (ok) {
      haptic('success')
      setText('')
      load()
    } else {
      haptic('error')
    }
  }

  const remove = async (id: string) => {
    haptic('light')
    setComments((prev) => prev?.filter((c) => c.id !== id) ?? null)
    await deleteComment(id)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal discussion" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="discussion-title">
            <span className="discussion-title-row"><IconChat size={17} className="chat-inline" /> {title}</span>
            {author && <span className="discussion-author">{author}</span>}
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>

        <div className="comments" ref={listRef}>
          {error ? (
            <p className="empty-hint">Не удалось загрузить отзывы.</p>
          ) : comments === null ? (
            <p className="empty-hint">Загрузка…</p>
          ) : comments.length === 0 ? (
            <p className="empty-hint">Пока нет отзывов. Будьте первым! ✍️</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className={c.user.id === myId ? 'comment mine' : 'comment'}>
                {c.user.photo_url ? (
                  <img className="comment-avatar" src={c.user.photo_url} alt="" />
                ) : (
                  <div className="comment-avatar comment-avatar-letter">
                    {c.user.name.trim().charAt(0).toUpperCase() || '📖'}
                  </div>
                )}
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-name">{c.user.name}</span>
                    <span className="comment-date">{formatDate(c.created_at)}</span>
                    {c.user.id === myId && (
                      <button className="comment-delete" onClick={() => remove(c.id)} aria-label="Удалить отзыв">
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="comment-text">{c.text}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {myId !== null ? (
          <div className="comment-input-row">
            <textarea
              className="comment-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ваш отзыв или мысль о книге…"
              rows={2}
              maxLength={1000}
            />
            <button className="comment-send" onClick={send} disabled={!text.trim() || sending} aria-label="Отправить">
              <IconSend size={19} />
            </button>
          </div>
        ) : (
          <p className="comment-login-hint">Писать отзывы можно из Telegram</p>
        )}
      </div>
    </div>
  )
}
