# Вёрстка на Bootstrap (локально, без CDN) — banx

**Запуск:** открыть `index.html` в браузере. Работает без интернета.

```
lab4-bootstrap-banx/
├── index.html
├── style.css                       ← дополнительные стили
├── dist/                           ← Bootstrap 5.3.3, скачан локально
│   ├── css/bootstrap.min.css
│   └── js/bootstrap.bundle.min.js
└── img/
```

## Чек-лист требований

- Bootstrap скачан и лежит в `dist/`, CDN не используется.
- Подключение относительными путями: `dist/css/bootstrap.min.css` в `<head>`, `dist/js/bootstrap.bundle.min.js` перед `</body>`.
- Свои стили вынесены в отдельный `style.css`.
- Используемые возможности Bootstrap:
  - `container`, сетка `row` / `col-*` (`col-lg-7`, `col-sm-6 col-lg-3`, `col-6 col-md-3` …);
  - flex-утилиты (`d-flex`, `justify-content-*`, `align-items-*`, `gap-*`, `flex-wrap`);
  - кнопки (`btn`, `btn-lg`, `btn-light`, своя тема `btn-banx`);
  - формы (`form-control`, `form-select`, `form-check`, `form-label`);
  - компоненты Navbar (сворачивается в «бургер»), Card, Badge, Accordion (оба работают через Bootstrap JS);
  - утилиты отступов, теней, скруглений и цвета.

> Макет `hw_design.jpg` в материалах не было, поэтому страница сделана по требованиям задания на картинках banx. Если пришлёшь макет, переверстаю под него.

![screenshot](screenshot.jpg)
