# Laboratory Work — страница на Bootstrap 5 («Freedom»)

Вёрстка по макету [`materials/lab5-reference/freedom.jpg`](../materials/lab5-reference/freedom.jpg) на HTML5, CSS3 и Bootstrap 5.

**Запуск:** открыть `index.html` в браузере. Нужен интернет: Bootstrap и Bootstrap Icons подключены через CDN, как требует задание.

```
lab5-bootstrap-freedom/
├── index.html
├── style.css      ← свои цвета, размеры, hover-эффекты
└── images/        ← картинки из задания
```

## Чек-лист требований

- **Bootstrap 5 и Bootstrap Icons через CDN** (jsdelivr).
- **Navbar**: логотип и ссылки Home, Portfolio, Blog, Contact, Shop. Все пункты — ссылки, при наведении меняется цвет текста (`:hover`). На телефоне меню сворачивается в «бургер».
- **Carousel**:
  - 3 слайда из присланных картинок, листаются автоматически (каждые 4 с);
  - 3 индикатора внизу, активный закрашен фиолетовым, клик по индикатору открывает нужный слайд;
  - стрелки Previous / Next в кругах слева и справа.
- **«La Liberté guidant le peuple»**: заголовок и текст по центру.
- **«Postérité de l'œuvre»**: 3 блока в ряд (`row` / `col-md-4`), иконки Bootstrap Icons (`bi-gear`, `bi-eye`, `bi-arrow-repeat`) в кругах.
- **«Notre Equipe»**: 3 участника с фото, именем, должностью, описанием и кнопками соцсетей (Bootstrap Icons).
- **«PORTFOLIO»**: галерея из 8 картинок, 4 в ряд (`row g-0`, `col-6 col-md-3`).
- **Footer** по макету.
- **Адаптивность**: на компьютере, планшете и телефоне. CSS Grid, Tailwind и другие фреймворки не используются.

> Широкая картинка в задании только одна (`slide_pic.jpg`). Остальные маленькие (289×263) и на весь экран выглядели бы размыто. Поэтому слайды 2 и 3 собраны из 4 картинок портфолио в ряд.

![screenshot](screenshot.jpg)
