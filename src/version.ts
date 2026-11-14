// Автообновление: сравниваем вшитую метку сборки с version.json на сервере.
// Если на сервере новее — предлагаем пользователю перезагрузить страницу.

declare const __BUILD_ID__: string

export const BUILD_ID = __BUILD_ID__

export async function checkForUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return false
    const data = await res.json()
    return typeof data.id === 'string' && data.id !== BUILD_ID
  } catch {
    return false // нет сети или dev-режим — молчим
  }
}
