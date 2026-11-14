-- Флаг блокировки пользователя для админ-панели
ALTER TABLE users ADD COLUMN banned INTEGER NOT NULL DEFAULT 0;
