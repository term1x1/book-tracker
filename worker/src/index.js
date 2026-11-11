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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

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
