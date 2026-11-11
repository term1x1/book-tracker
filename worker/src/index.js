// Telegram-бот трекера книг: отвечает на /start приветствием
// с кнопкой открытия Mini App. Работает на Cloudflare Workers (бесплатно).

const WELCOME = (name) => `👋 Привет${name ? ', ' + name : ''}!

Это «Мои книги» — твой личный трекер чтения прямо в Telegram.

📚 Веди библиотеку: «Хочу прочитать» → «Читаю» → «Прочитано»
🔍 Добавляй книги за секунды — поиск сам подставит автора и обложку
📖 Отмечай прогресс по страницам
⭐ Ставь оценки и пиши заметки
📊 Смотри статистику: сколько прочитано за год, любимые жанры

Данные хранятся в облаке Telegram и синхронизируются между твоими устройствами. Жми кнопку ниже 👇`

async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

// Счётчик пользователей в KV: ключи bot:<id> и app:<id>,
// значение {f: первый визит, l: последний визит} (ISO-даты)
async function remember(env, key) {
  try {
    const now = new Date().toISOString()
    const raw = await env.USERS.get(key)
    if (!raw) {
      await env.USERS.put(key, JSON.stringify({ f: now, l: now }))
      return
    }
    // старый формат — просто ISO-строка
    const rec = raw.startsWith('{') ? JSON.parse(raw) : { f: raw, l: raw }
    // пишем не чаще раза в день, чтобы не плодить записи
    if (rec.l.slice(0, 10) !== now.slice(0, 10)) {
      rec.l = now
      await env.USERS.put(key, JSON.stringify(rec))
    }
  } catch {
    // статистика не должна ломать бота
  }
}

async function loadRecords(env, prefix) {
  const keys = []
  let cursor
  do {
    const page = await env.USERS.list({ prefix, cursor })
    keys.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? null : page.cursor
  } while (cursor)
  const records = await Promise.all(
    keys.map(async (name) => {
      const raw = await env.USERS.get(name)
      if (!raw) return null
      return raw.startsWith('{') ? JSON.parse(raw) : { f: raw, l: raw }
    }),
  )
  return records.filter(Boolean)
}

function buildStats(appRecords, botRecords) {
  const now = Date.now()
  const day = 86400000
  const activeSince = (records, days) =>
    records.filter((r) => now - Date.parse(r.l) < days * day).length

  // новые пользователи приложения по дням за последние 14 дней
  const byDay = []
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now - i * day).toISOString().slice(0, 10)
    byDay.push({
      date,
      new: appRecords.filter((r) => r.f.slice(0, 10) === date).length,
      active: appRecords.filter((r) => r.l.slice(0, 10) === date).length,
    })
  }

  return {
    app_total: appRecords.length,
    bot_total: botRecords.length,
    app_active_7d: activeSince(appRecords, 7),
    app_active_30d: activeSince(appRecords, 30),
    by_day: byDay,
  }
}

// Страница статистики в стиле приложения
const DASHBOARD = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Статистика · Мои книги</title>
<style>
  :root {
    --bg: #16283f; --page: #0d1a2c; --text: #e8f1fc;
    --hint: #8ba4c4; --accent: #2b7de9; --radius: 14px;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg: #ffffff; --page: #e9f1fc; --text: #13233a; --hint: #64799a; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 20px; display: flex; align-items: center; gap: 8px; margin: 4px 0 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
  .tile { background: var(--bg); border-radius: var(--radius); padding: 16px; text-align: center; }
  .num { font-size: 30px; font-weight: 700; }
  .lbl { color: var(--hint); font-size: 12.5px; margin-top: 3px; }
  .card { background: var(--bg); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; }
  .card h2 { font-size: 14px; margin: 0 0 14px; color: var(--hint); font-weight: 500; }
  .chart { display: flex; align-items: flex-end; gap: 4px; height: 110px; }
  .col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
  .bar { background: var(--accent); border-radius: 4px 4px 0 0; min-height: 2px; opacity: .9; }
  .bar.zero { background: var(--hint); opacity: .18; }
  .dates { display: flex; gap: 4px; margin-top: 6px; }
  .dates span { flex: 1; text-align: center; font-size: 9.5px; color: var(--hint); }
  .muted { color: var(--hint); font-size: 13px; text-align: center; padding: 8px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>📊 Статистика «Мои книги»</h1>
  <div class="grid" id="tiles"><div class="muted">Загрузка…</div></div>
  <div class="card">
    <h2>Новые пользователи приложения · 14 дней</h2>
    <div class="chart" id="chart"></div>
    <div class="dates" id="dates"></div>
  </div>
</div>
<script>
fetch('/stats.json').then(r => r.json()).then(s => {
  const t = (n, l) => '<div class="tile"><div class="num">' + n + '</div><div class="lbl">' + l + '</div></div>';
  document.getElementById('tiles').innerHTML =
    t(s.app_total, 'всего в приложении') +
    t(s.bot_total, 'всего писали боту') +
    t(s.app_active_7d, 'активны за 7 дней') +
    t(s.app_active_30d, 'активны за 30 дней');
  const max = Math.max(1, ...s.by_day.map(d => d.new));
  document.getElementById('chart').innerHTML = s.by_day.map(d =>
    '<div class="col" title="' + d.date + ': +' + d.new + '"><div class="bar' +
    (d.new ? '' : ' zero') + '" style="height:' + Math.round(d.new / max * 100) + '%"></div></div>'
  ).join('');
  document.getElementById('dates').innerHTML = s.by_day.map((d, i) =>
    '<span>' + (i % 2 ? '' : d.date.slice(8) + '.' + d.date.slice(5, 7)) + '</span>'
  ).join('');
}).catch(() => {
  document.getElementById('tiles').innerHTML = '<div class="muted">Не удалось загрузить данные</div>';
});
</script>
</body>
</html>`

const CORS = {
  'Access-Control-Allow-Origin': 'https://term1x1.github.io',
  'Access-Control-Allow-Methods': 'GET',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Приложение отмечается при открытии: /ping?uid=<telegram user id>
    if (url.pathname === '/ping') {
      const uid = url.searchParams.get('uid')
      if (uid && /^\d{1,20}$/.test(uid)) {
        await remember(env, `app:${uid}`)
      }
      return new Response('ok', { headers: CORS })
    }

    // JSON-статистика
    if (url.pathname === '/stats.json') {
      const [appRecords, botRecords] = await Promise.all([
        loadRecords(env, 'app:'),
        loadRecords(env, 'bot:'),
      ])
      return Response.json(buildStats(appRecords, botRecords), { headers: CORS })
    }

    // Мини-дашборд
    if (url.pathname === '/stats') {
      return new Response(DASHBOARD, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Одноразовая настройка: открыть https://<worker>/setup в браузере
    if (url.pathname === '/setup') {
      const result = await tg(env.BOT_TOKEN, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message'],
      })
      return Response.json(result)
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      // принимаем запросы только от Telegram
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 })
      }
      const update = await request.json()
      const msg = update.message
      if (msg?.chat?.id) {
        await remember(env, `bot:${msg.chat.id}`)
      }
      if (msg?.text?.startsWith('/start')) {
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: WELCOME(msg.from?.first_name ?? ''),
          reply_markup: {
            inline_keyboard: [
              [{ text: '📚 Открыть библиотеку', web_app: { url: env.MINI_APP_URL } }],
            ],
          },
        })
      } else if (msg?.text) {
        // на любой другой текст — короткая подсказка с той же кнопкой
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: 'Вся магия — в приложении 👇',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📚 Открыть библиотеку', web_app: { url: env.MINI_APP_URL } }],
            ],
          },
        })
      }
      return new Response('ok')
    }

    return new Response('Book tracker bot is running')
  },
}
