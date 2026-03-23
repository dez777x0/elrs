# Развёртывание ELRS Web Flasher (`web-flasher/`)

Статическое SPA после `npm run build` — каталог **`web-flasher/dist/`**. Сервер должен отдавать файлы по HTTPS (см. ниже).

## Сборка

```bash
cd web-flasher
npm ci
npm run build
```

Проверка локально (тоже нужен **HTTPS** для Web Serial в Chromium, кроме `localhost`):

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

Для `http://localhost` и `http://127.0.0.1` браузеры считают контекст **безопасным** для Web Serial API.

## Почему HTTPS

**Web Serial** и часть возможностей PWA доступны только в [secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): `https://`, `localhost`, `127.0.0.1`. Публикация только по `http://192.168.x.x` с другой машины обычно **ломает** выбор порта в Chromium.

## Статический хостинг

Подойдёт любой хостинг статики: **Cloudflare Pages**, **GitHub Pages**, **Netlify**, **S3 + CloudFront**, свой **nginx**.

- Выставьте корень сайта на содержимое `dist/` (в т.ч. `index.html`).
- Для SPA без серверного роутинга достаточно одного `index.html` на все пути *или* правила «fallback на index.html», если позже появятся клиентские маршруты.
- **Базовый путь (`base`)** в Vite по умолчанию `/`. Если приложение живёт в подкаталоге (например `https://example.com/flasher/`), задайте в `vite.config.ts` опцию `base: '/flasher/'` и пересоберите.

## Пример nginx

```nginx
server {
  listen 443 ssl;
  server_name flasher.example.com;
  root /var/www/elrs-web-flasher/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## PWA / Service Worker

`vite-plugin-pwa` генерирует `sw.js` и прекеширует ассеты. После деплоя проверьте, что **MIME** для `.js` корректен и кэш CDN не отдаёт устаревший `sw.js` бесконечно (при необходимости настройте заголовки кэширования для HTML/SW).

## OTA с телефона

Для загрузки по Wi‑Fi достаточно открыть тот же хост по HTTPS или использовать встроенный в RX веб-интерфейс; см. также [ota-endpoints.md](./ota-endpoints.md).
