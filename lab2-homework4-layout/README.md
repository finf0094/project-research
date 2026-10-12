# Practical Assignment — вёрстка страницы по референсу `homework_4.jpg`

Страница максимально приближена к референсу ([`materials/lab2-reference/homework_4.jpg`](../materials/lab2-reference/homework_4.jpg)). Сделана только на HTML и CSS, без фреймворков.

**Запуск:** открыть `index.html` в браузере.

```
lab2-homework4-layout/
├── index.html
├── main.css          ← подключён через <link>
├── fonts/            ← Roboto / Roboto Condensed (локально)
└── img/              ← иконки и фото из homework_images.zip + свой фон hero-bg.jpg
```

## Структура страницы

1. **Header**: название сайта и горизонтальное меню (Home, About, Work, Contact).
2. **Hero**: свой фон (по заданию каждый выбирает свою картинку) под бирюзовым слоем, заголовок, подзаголовок и кнопка *Read More*. Текст лежит поверх фона (`position: absolute`).
3. **Четыре блока 2×2** (красный, жёлтый, зелёный, фиолетовый): иконка в белом круге, заголовок и описание. Раскладка на Flexbox с `flex-wrap`.
4. **Заголовок секции**: заголовок и подзаголовок с декоративной линией (`::before`).
5. **Три карточки** в ряд: круглое фото (`border-radius: 50%`), текст, кнопка *Read More* и цветная верхняя граница.
6. **Footer**: копирайт и автор.

## Чек-лист CSS-требований

- отдельные `index.html` и `main.css`, подключение через `<link>`
- теги `header`, `div`, `h1`–`h3`, `p`, `span`, `a`, `img`, `ul`, `li`, `footer`
- общий `.container` для контента
- `display: flex`, `justify-content`, `align-items`, `flex-wrap`
- `margin`, `padding`, `width`, `height`
- `background-color`, свой `background-image`
- `border`, `border-radius`
- `position: relative` / `position: absolute`
- псевдоэлемент `::before` (цветной слой на hero, линия у подзаголовка)
- круглые картинки в карточках

> Фон hero — своя картинка `img/hero-bg.jpg` (город). Чтобы поставить другую, достаточно заменить этот файл.

![screenshot](screenshot.jpg)
