-- Закреплённые книги (витрина профиля, до 3)
ALTER TABLE books ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
