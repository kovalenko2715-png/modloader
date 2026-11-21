# 🌾 Общая Грядка — ферма-мини-апп для Telegram

Изометрическая ферма внутри Telegram (Mini App): тапами сажаете, поливаете,
собираете урожай, расширяете территорию. Общий топ игроков — optional через Supabase
на бесплатном тарифе. Свой сервер НЕ нужен.

## Как играть самому (прямо сейчас)

Игра работает и без Telegram: откройте `index.html` в браузере или задеплойте
на GitHub Pages — зайдёте как «Гость».

## Что в игре

- изометрическая сетка 5×5 → 7×7 → 9×9 (расширение за монеты)
- 3 культуры (морковь, редис, картофель) с разным временем роста и ценой
- посадка = тап → полив = тап → сбор созревшего = тап
- монеты за урожай, топ-10 игроков
- шаринг ссылки на игру (Telegram / системное меню)

Ассеты: Kenney (Tiny Farm tile_0001..0013, Isometric Blocks, Isometric Nature,
Animal Pack) — лицензия CC0, взятые из репозитория shorepine/kenney.

## Настройка онлайн-топа (Supabase, бесплатно, 5 минут)

1. Зайдите на https://supabase.com → Sign up → New project (любое имя)
2. Слева: SQL Editor → вставьте содержимое `supabase/schema.sql` → Run
3. Слева: Project Settings → API: скопируйте `Project URL` и `anon public` ключ
4. В корне репозитория откройте `config.js` и вставьте их:

```js
window.FARM_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "ey..."
};
```

5. Закоммитьте и запушьте — топ заработает для всех игроков

## Подключение к Telegram (Mini App + кнопка в группе)

1. Откройте бот @BotFather → `/newbot` → имя, юзернейм (например, `my_farm_bot`)
2. `/mybots` → ваш бот → **Bot Settings → Menu Button → Configure menu button**:
   название «🌾 Ферма», ссылка = URL вашей GitHub Pages (см. ниже)
3. Добавьте бота в свою группу (обычно с правами администратора не обязательно)
4. В группе появятся: меню-кнопка бота с фермой (у каждого участника своя ферма,
   вход по его Telegram-аккаунту автоматически)

## Деплой на GitHub Pages

Pages включается воркфлоу `.github/workflows/pages.yml` при пуше в `main`.
Если Pages ещё не активирован: Settings → Pages → Source: **GitHub Actions**,
затем перезапустите workflow (Actions → Deploy Farm → Run workflow).

Адрес игры будет: `https://kovalenko2715-png.github.io/modloader/`

## Что дальше (roadmap)

- [ ] бот-анонсы в группе: «Саша собрал урожай», еженедельный топ по понедельникам
- [ ] визиты на фермы друзей + взаимный полив (бонус обоим)
- [ ] общий склад группы: скидываемся 5% урожая → бонус-сезон всем
- [ ] животные, декор, питомец-кот
- [ ] антифрод: проверка Telegram initData на серверной функции Supabase

## Структура

```
index.html          — страница мини-аппа
config.js           — ваши ключи Supabase (пусто = офлайн-режим)
src/app.js          — вся логика игры
src/style.css       — стили
assets/             — спрайты (Kenney, CC0)
supabase/schema.sql — таблица игроков
.github/workflows/pages.yml — автодеплой на GitHub Pages
```
