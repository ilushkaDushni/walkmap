Название

# Walkmap — Социальная PWA для создания и обмена пешеходными маршрутами

**Описание**

**Walkmap** — это прогрессивное веб-приложение (PWA), которое превращает создание пешеходных маршрутов в увлекательный социальный опыт. Проект сочетает в себе функции картографического сервиса, игровые элементы (магазин, предметы) и полноценное социальное взаимодействие (друзья, чаты, лобби), работая как современное нативное приложение.
Ключевые возможности

  **🗺️ Создание и публикация маршрутов: Пользователи могут прокладывать собственные пешеходные маршруты и делиться ими с сообществом.**

  **🎮 Игровой подход (Геймификация): Встроенный магазин с предметами, права на редактирование и систему разрешений (shop.edit permission), что делает процесс более увлекательным.**

  **👥 Социальная сеть внутри приложения:**

        Система друзей.

        Чаты для общения.

        Лобби для совместной деятельности или планирования прогулок.

        Система уведомлений о событиях.

   **🔐 Безопасность и масштабирование:**

        JWT-аутентификация для защиты данных пользователей.

        Интеграция с Vercel Blob для загрузки медиафайлов.

        Проксирование S3 с подписью aws4 для работы с облачными хранилищами (например, Yandex Cloud).



  **Технологический стек**

    Фреймворк: Next.js (bootstrapped with create-next-app)

    Язык: JavaScript (99.5%)

    Стилизация: CSS (0.5%) + PostCSS

    Аутентификация: JSON Web Tokens (JWT)

    Хранение файлов: Vercel Blob Storage, Yandex Cloud (S3-совместимое) с подписанными запросами

    База данных: Информация на данный момент отсутствует в README (предположительно, используется в API-маршрутах Next.js)

    Деплой: Vercel (проект доступен по адресу walkmap-phi.vercel.app)
  # Начало работы:
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
