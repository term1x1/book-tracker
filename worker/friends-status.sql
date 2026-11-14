-- Заявки в друзья: pending (отправлена) / accepted (взаимная дружба).
-- Старые односторонние записи считаем уже принятыми.
ALTER TABLE friends ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted';
