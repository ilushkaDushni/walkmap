"use client";

import { useState } from "react";
import { Compass, Gamepad2, Users, MessageCircle, Trophy, Shield, Flame, Smartphone, X } from "lucide-react";

const FEATURES = [
  {
    icon: Compass,
    title: "GPS-навигация",
    desc: "Интерактивные маршруты с чекпоинтами, аудиогидом и пошаговой навигацией по карте",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    details: [
      "Пошаговая навигация с отображением текущей позиции на карте",
      "Автоматическое срабатывание чекпоинтов при приближении (GPS-радиус)",
      "Аудиогид — озвучка описаний точек маршрута",
      "Отслеживание прогресса прохождения в реальном времени",
      "Запись GPS-трека с сохранением пройденного пути",
      "Работает даже без интернета благодаря кешированию карт",
    ],
  },
  {
    icon: Gamepad2,
    title: "Геймификация",
    desc: "30 достижений, система уровней, внутренняя валюта и магазин косметики",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    details: [
      "30 уникальных достижений за различные активности",
      "Система уровней с прогресс-баром опыта",
      "Внутренняя валюта (монеты) за прохождение маршрутов",
      "Магазин косметики: рамки аватаров, титулы, темы оформления",
      "Промокоды для получения бонусных монет",
      "Инвентарь с экипировкой купленных предметов",
    ],
  },
  {
    icon: Users,
    title: "Мультиплеер",
    desc: "Гонки в лобби, челленджи между игроками, подиум с результатами",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    details: [
      "Создание лобби для совместного прохождения маршрута",
      "Гонки в реальном времени с отслеживанием позиций участников",
      "Челленджи — вызов другу на прохождение маршрута",
      "Подиум с результатами и временем каждого участника",
      "Приглашение друзей по ссылке или из списка друзей",
      "Система готовности и обратного отсчёта перед стартом",
    ],
  },
  {
    icon: MessageCircle,
    title: "Чат-система",
    desc: "Личные и групповые чаты с голосовыми сообщениями, реакциями и стикерами",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    details: [
      "Личные сообщения между пользователями",
      "Групповые чаты с управлением участниками",
      "Голосовые сообщения с записью и воспроизведением",
      "Реакции на сообщения (эмодзи)",
      "Стикерпак с набором стикеров",
      "Пересылка, закрепление и поиск по сообщениям",
    ],
  },
  {
    icon: Trophy,
    title: "Рекорды и лидерборд",
    desc: "Таблица лучших времён на каждом маршруте, глобальный рейтинг игроков",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    details: [
      "Таблица рекордов для каждого маршрута",
      "Глобальный лидерборд по очкам опыта",
      "Рейтинг по количеству пройденных маршрутов",
      "Рейтинг по суммарному пройденному расстоянию",
      "Личная статистика с историей прохождений",
      "Сравнение результатов с друзьями",
    ],
  },
  {
    icon: Shield,
    title: "Ролевая система",
    desc: "19 пермишенов, кастомные роли в стиле Discord, админ-панель",
    color: "text-red-500",
    bg: "bg-red-500/10",
    details: [
      "19 гранулярных пермишенов для точного контроля доступа",
      "Кастомные роли с выбором цвета и приоритета",
      "Система ролей в стиле Discord с иерархией",
      "Админ-панель для управления пользователями и контентом",
      "Система банов с историей и причинами",
      "Тикет-система для обращений пользователей",
    ],
  },
  {
    icon: Flame,
    title: "Тепловая карта",
    desc: "Визуализация активности всех пользователей на карте города",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    details: [
      "Тепловая карта на основе GPS-треков всех пользователей",
      "Визуализация популярных маршрутов и мест",
      "Отображение зон активности в реальном времени",
      "Фильтрация по периоду времени",
      "Градиентная заливка с интенсивностью активности",
      "Помогает находить интересные места, популярные у других игроков",
    ],
  },
  {
    icon: Smartphone,
    title: "PWA",
    desc: "Работает оффлайн, устанавливается на домашний экран, кеширует карты и контент",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    details: [
      "Установка на домашний экран как нативное приложение",
      "Работа без интернета благодаря Service Worker",
      "Кеширование тайлов карт для оффлайн-навигации",
      "Push-уведомления о новых сообщениях и событиях",
      "Автоматическое обновление контента при появлении сети",
      "Адаптивный дизайн для любого размера экрана",
    ],
  },
];

export default function FeaturesSection() {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 px-1">Возможности</h2>
      <div className="space-y-2.5">
        {FEATURES.map((f) => {
          const Ic = f.icon;
          return (
            <button
              key={f.title}
              onClick={() => setSelected(f)}
              className="glass-card p-4 flex gap-3.5 w-full text-left cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.bg} shrink-0`}>
                <Ic className={`h-5 w-5 ${f.color}`} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{f.title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md mx-auto bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 mb-5 pr-8">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selected.bg} shrink-0`}>
                <selected.icon className={`h-6 w-6 ${selected.color}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{selected.title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{selected.desc}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2.5">
              {selected.details.map((detail, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${selected.color.replace("text-", "bg-")}`} />
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
