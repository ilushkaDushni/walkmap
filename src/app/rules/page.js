"use client";

import {
  ArrowLeft,
  ShieldAlert,
  MessageCircle,
  Image,
  Users,
  Gavel,
  MapPin,
  UserCircle,
  Heart,
  Info,
  AlertTriangle,
  Ban,
  CircleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function RulesPage() {
  const router = useRouter();
  let idx = 0;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Header */}
      <div
        className="flex items-center gap-3 mb-6 rules-animate"
        style={{ "--i": idx++ }}
      >
        <button
          onClick={() => router.back()}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Правила сообщества
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Ростов GO</p>
        </div>
      </div>

      {/* Вступление */}
      <div
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 mb-4 rules-animate"
        style={{ "--i": idx++ }}
      >
        <div className="flex items-start gap-3">
          <Heart className="h-5 w-5 text-pink-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Ростов GO — это сообщество любителей прогулок. Мы хотим, чтобы
            каждому здесь было комфортно и интересно. Эти правила помогают
            поддерживать дружелюбную атмосферу. Пожалуйста, прочитайте их —
            это не займёт много времени.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Общие правила */}
        <Section
          icon={<Users className="h-5 w-5 text-blue-500" />}
          title="Общие правила поведения"
          color="blue"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Уважайте других пользователей"
              detail="Каждый имеет право на своё мнение. Даже если вы не согласны — выражайте это вежливо. Оскорбления, унижения и переход на личности недопустимы."
            />
            <Rule
              text="Никакой дискриминации"
              detail="Запрещены высказывания, унижающие людей по национальности, расе, полу, возрасту, религии, ориентации, инвалидности или любому другому признаку."
            />
            <Rule
              text="Запрещена реклама и спам"
              detail="Не размещайте рекламу товаров, услуг, каналов, сайтов или других приложений. Это касается комментариев, чатов, никнеймов и аватаров."
            />
            <Rule
              text="Не выдавайте себя за других"
              detail="Запрещено притворяться другим пользователем, модератором или администратором. Не используйте чужие фотографии и имена с целью обмана."
            />
            <Rule
              text="Не злоупотребляйте багами"
              detail="Если вы нашли ошибку в приложении — сообщите нам, а не используйте её для получения монет, обхода ограничений или других выгод. За помощь в нахождении багов мы будем благодарны!"
            />
          </ul>
        </Section>

        {/* Никнейм */}
        <Section
          icon={<UserCircle className="h-5 w-5 text-cyan-500" />}
          title="Имя пользователя"
          color="cyan"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Никнейм не должен быть оскорбительным"
              detail="Запрещены ники с матом, оскорблениями, провокациями и дискриминацией. Примеры недопустимых ников: содержащие ненормативную лексику, призывы к насилию или ненависти."
            />
            <Rule
              text="Не имитируйте администрацию"
              detail="Запрещены ники вроде «admin», «moderator», «Ростов GO Official» и подобные, создающие впечатление причастности к команде проекта."
            />
            <Rule
              text="Без рекламы в никнейме"
              detail="Нельзя использовать никнейм для продвижения сайтов, каналов или товаров."
            />
          </ul>
        </Section>

        {/* Аватары */}
        <Section
          icon={<Image className="h-5 w-5 text-purple-500" />}
          title="Аватары"
          color="purple"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Без откровенного контента"
              detail="Запрещены изображения сексуального, порнографического или непристойного характера, в том числе частично."
            />
            <Rule
              text="Без шока и провокаций"
              detail="Запрещены изображения насилия, жестокости, расчленения, а также символика, разжигающая ненависть."
            />
            <Rule
              text="Без нарушений закона"
              detail="Аватар не должен содержать запрещённую в РФ символику, пропаганду наркотиков, экстремизма и т.д."
            />
            <Rule
              text="Не вводите людей в заблуждение"
              detail="Не используйте чужие фотографии и логотипы с целью выдать себя за другого человека или организацию."
            />
          </ul>
        </Section>

        {/* Маршруты */}
        <Section
          icon={<MapPin className="h-5 w-5 text-emerald-500" />}
          title="Маршруты"
          color="emerald"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Называйте маршруты осмысленно"
              detail="Название должно отражать суть маршрута. Избегайте бессмысленных, оскорбительных или рекламных названий."
            />
            <Rule
              text="Описание должно быть полезным"
              detail="Расскажите, что интересного на маршруте, какие достопримечательности, кафе или виды. Не оставляйте описание пустым и не используйте его для спама."
            />
            <Rule
              text="Точки маршрута должны быть реальными"
              detail="Указывайте реальные места, которые можно посетить. Не создавайте маршруты из случайных точек или с заведомо ложной информацией."
            />
            <Rule
              text="Не дублируйте маршруты"
              detail="Перед созданием проверьте, нет ли уже похожего маршрута. Если хотите дополнить чужой маршрут — напишите комментарий."
            />
          </ul>
        </Section>

        {/* Комментарии */}
        <Section
          icon={<MessageCircle className="h-5 w-5 text-green-500" />}
          title="Комментарии"
          color="green"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Без мата и грубости"
              detail="Ненормативная лексика запрещена даже в завуалированном виде (замена букв символами, сокращения). Общайтесь так, как хотели бы, чтобы общались с вами."
            />
            <Rule
              text="Без оскорблений и травли"
              detail="Запрещены персональные нападки, буллинг, высмеивание и систематическое давление на конкретного пользователя."
            />
            <Rule
              text="Без спама и флуда"
              detail="Не отправляйте одинаковые сообщения, бессмысленные наборы символов или множество сообщений подряд. Один продуманный комментарий лучше десяти пустых."
            />
            <Rule
              text="Без запрещённого контента и ссылок"
              detail="Не размещайте ссылки на вредоносные сайты, пиратский контент, запрещённые материалы. Ссылки на полезные ресурсы по теме маршрута допускаются."
            />
            <Rule
              text="Не публикуйте чужие личные данные"
              detail="Запрещено раскрывать чужие имена, адреса, телефоны, фото и другую личную информацию без согласия человека (доксинг)."
            />
          </ul>
        </Section>

        {/* Чаты и лобби */}
        <Section
          icon={<ShieldAlert className="h-5 w-5 text-orange-500" />}
          title="Личные сообщения и лобби"
          color="orange"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Без угроз и шантажа"
              detail="Любые угрозы — физические, психологические, финансовые — строго запрещены и могут повлечь немедленный бан и обращение в правоохранительные органы."
            />
            <Rule
              text="Без мошенничества"
              detail="Запрещены любые попытки обмана: выманивание монет, фальшивые обещания, подставные сделки. При наличии доказательств — перманентный бан."
            />
            <Rule
              text="Без спам-рассылок"
              detail="Не отправляйте массовые однотипные сообщения разным пользователям. Это касается и приглашений в лобби."
            />
            <Rule
              text="Без преследования"
              detail="Если человек не хочет общаться — оставьте его в покое. Навязчивые сообщения после отказа считаются преследованием."
            />
            <Rule
              text="Лобби — для прогулок"
              detail="Создавайте лобби для совместных прогулок, а не для рекламы, сбора данных или других посторонних целей."
            />
          </ul>
        </Section>

        {/* Монеты */}
        <Section
          icon={<Info className="h-5 w-5 text-yellow-500" />}
          title="Монеты и подарки"
          color="yellow"
          i={idx++}
        >
          <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
            <Rule
              text="Монеты нельзя обменивать на реальные деньги"
              detail="Монеты — внутренняя валюта приложения. Попытки продать или купить монеты за реальные деньги запрещены."
            />
            <Rule
              text="Не выпрашивайте монеты"
              detail="Навязчивые просьбы подарить монеты считаются спамом. Дарение монет — добровольное действие."
            />
            <Rule
              text="Не используйте баги для накрутки"
              detail="Любая искусственная накрутка монет (мультиаккаунты, баги, скрипты) приведёт к обнулению баланса и бану."
            />
          </ul>
        </Section>

        {/* Система наказаний */}
        <Section
          icon={<Gavel className="h-5 w-5 text-red-500" />}
          title="Система наказаний"
          color="red"
          i={idx++}
        >
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
            Мы стараемся решать конфликты мирно. Но если правила нарушены —
            наказание зависит от тяжести проступка. Ниже — конкретные
            примеры и меры.
          </p>

          {/* Лёгкие */}
          <PunishmentCategory
            icon={<CircleAlert className="h-4 w-4 text-yellow-500" />}
            title="Лёгкие нарушения"
            subtitle="Предупреждение, при повторе — бан 1-3 дня"
            color="yellow"
            items={[
              "Мат или грубость в комментариях",
              "Флуд и бессмысленные сообщения",
              "Некорректный никнейм или аватар",
              "Мелкий спам (единичный случай)",
              "Бессмысленное или пустое описание маршрута",
              "Навязчивое выпрашивание монет",
            ]}
          />

          {/* Средние */}
          <PunishmentCategory
            icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
            title="Средние нарушения"
            subtitle="Бан 3-14 дней, удаление контента"
            color="orange"
            items={[
              "Оскорбления и травля конкретного пользователя",
              "Систематический спам или реклама",
              "Публикация чужих личных данных (доксинг)",
              "Создание фейковых / мусорных маршрутов",
              "Имитация администрации (ник, аватар)",
              "Преследование пользователя после отказа",
              "Повторные лёгкие нарушения (3+ раз)",
            ]}
          />

          {/* Тяжёлые */}
          <PunishmentCategory
            icon={<Ban className="h-4 w-4 text-red-500" />}
            title="Тяжёлые нарушения"
            subtitle="Перманентный бан без предупреждения"
            color="red"
            items={[
              "Угрозы, шантаж, запугивание",
              "Мошенничество и обман пользователей",
              "Запрещённый контент (18+, насилие, экстремизм)",
              "Дискриминация и разжигание ненависти",
              "Накрутка монет (мультиаккаунты, баги, скрипты)",
              "Использование багов приложения в корыстных целях",
              "Попытки взлома аккаунтов или приложения",
              "Продажа / покупка монет за реальные деньги",
            ]}
          />

          {/* Дополнительные меры */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Дополнительные меры:
            </p>
            <ul className="space-y-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-px">•</span>
                <span>
                  <span className="text-[var(--text-secondary)] font-medium">Удаление контента</span> —
                  нарушающие комментарии, маршруты и аватары удаляются без
                  предупреждения
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-px">•</span>
                <span>
                  <span className="text-[var(--text-secondary)] font-medium">Обнуление монет</span> —
                  при накрутке или мошенничестве баланс обнуляется
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--text-secondary)] mt-px">•</span>
                <span>
                  <span className="text-[var(--text-secondary)] font-medium">Сброс профиля</span> —
                  принудительная смена никнейма / удаление аватара при нарушениях
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] p-3">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Модераторы принимают решение исходя из контекста. Если вы
              считаете, что бан выдан несправедливо — напишите администрации,
              мы разберёмся.
            </p>
          </div>
        </Section>

        {/* Обратная связь */}
        <div
          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 rules-animate"
          style={{ "--i": idx++ }}
        >
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed space-y-2">
              <p>
                Если вы столкнулись с нарушением правил — сообщите модераторам.
                Мы рассмотрим каждую жалобу.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Администрация оставляет за собой право изменять правила.
                Используя приложение, вы соглашаетесь с актуальной версией правил.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, color, children, i }) {
  return (
    <div
      className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 rules-animate"
      style={{ "--i": i }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-${color}-500/10`}
        >
          {icon}
        </div>
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Rule({ text, detail }) {
  return (
    <li>
      <p className="font-medium text-[var(--text-primary)]">{text}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
        {detail}
      </p>
    </li>
  );
}

function PunishmentCategory({ icon, title, subtitle, color, items }) {
  return (
    <div className={`mb-3 rounded-xl border border-${color}-500/20 bg-${color}-500/5 p-3`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {title}
        </p>
      </div>
      <p className={`text-xs font-medium text-${color}-500 mb-2`}>
        {subtitle}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-xs text-[var(--text-secondary)] leading-relaxed"
          >
            <span className="text-[var(--text-muted)] mt-px">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
