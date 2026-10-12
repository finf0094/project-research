# Вёрстка по макету — SevenOaks (HTML5 + CSS3 + Flexbox)

Страница сверстана по макету из задания (макет лежит в [`materials/lab3-design`](../materials/lab3-design/)).

**Запуск:** открыть `index.html` в браузере. Лучше всего смотреть на широком экране, макет рассчитан примерно на 1900px.

```
lab3-sevenoaks-flexbox/
├── index.html
├── style.css
├── fonts/      ← Roboto (локально, работает без интернета)
└── img/        ← hero, stories, give, prayer
```

## Что сделано

- Вся раскладка на **Flexbox**. Не используются CSS Grid, Bootstrap, Tailwind и другие библиотеки.
- Header: логотип SevenOaks и меню (ABOUT, MEDIA, EVENTS, SHOP, GIVE).
- Hero: картинка и бирюзовый блок с приветствием.
- Три промо-карточки (Stories / Give online / Prayer): цветная плашка и стрелка через `::after`.
- Upcoming events: список событий и кнопки MORE; справа блок SevenOaks с текстом и ссылкой READ MORE.
- Footer: подписка на рассылку, Service times и копирайт.
- Меню и кнопки сделаны ссылками (`<a>`), у всех есть `:hover`.

> Опечатки из макета (Welcom, Signap, Sanday) исправлены.

![screenshot](screenshot.jpg)
