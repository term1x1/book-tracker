-- Отзывы и обсуждения книг. book_key — нормализованное «название|автор»,
-- общее для всех пользователей, у кого есть эта книга.
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  book_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_key, created_at);
