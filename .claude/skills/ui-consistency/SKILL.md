# UI Consistency — wow-nostalgia.github.io

## Коли застосовувати

- Проектуєш новий UI-елемент (кнопка, поле вводу, вкладка, дропдаун, таблиця, чіп, список)
- Додаєш нові CSS-класи до `style.css`
- Рецензуєш існуючі елементи на предмет відхилення від паттерну

---

## Дизайн-токени (завжди використовуй, не хардкодь)

Портовані вручну з Primer-примітивів (`@primer/primitives@11.9.0` — сам пакет
не підключений, тільки non-color токени radius/spacing/typography; колірна
палітра — власна). Не плутай з розділом [WoW-специфічні кольори](#wow-специфічні-кольори-не-дизайн-токени)
нижче — це окрема, навмисно не-темована група.

| Категорія | Змінні |
|---|---|
| Кольори тексту | `--color-text`, `--color-text-strong`, `--color-text-soft`, `--color-text-muted`, `--color-text-faint`, `--color-on-accent` (#ffffff, текст на насичених/темних кольорових фонах) |
| Поверхні | `--color-surface`, `--color-surface-soft`, `--color-surface-solid` (#1d2636), `--color-surface-overlay`, `--color-surface-table`, `--color-surface-modal` (#0f1c2e) |
| Бордюри | `--color-border`, `--color-border-soft`, `--color-border-mid`, `--color-border-strong`, `--color-border-accent` |
| Стани hover/active | `--color-hover`, `--color-hover-strong`, `--color-active` |
| Акценти | `--color-link` (#7baaf5), `--color-link-hover` (#ffd700), `--color-brand`, `--color-accent-gold`, `--color-accent-purple`, `--color-accent-orange` (#f2994a), `--color-accent-mint` (#6dd09a), `--color-accent-emerald` (#22c55e) |
| Семантика | `--color-success` (#63d471) — колір тексту/чіпів; `--color-success-strong` (#3a9e4a) + `--color-success-strong-hover` (#2f8a3e) — суцільний фон кнопки; `--color-danger` (#ff6b6b) + `--color-danger-hover` (#e05252); `--color-warning` (#f0ad4e) |
| Радіуси | `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (10px), `--radius-xl` (14px), `--radius-pill` (999px) |
| Тіні | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Анімація | `--transition-fast` (0.2s ease) |
| Відступи | `--space-1`…`--space-9` (0.15rem…2rem) |

> `--color-success` і `--color-success-strong` — це РІЗНІ токени для різних ролей, не одне й те саме перцепційно вирівняне значення: перший — для тексту/чіпів на темному тлі, другий — для суцільного фону кнопки (за задумом темніший, щоб не сліпив). Те саме для `--color-danger`/`--color-danger-hover`.

---

## WoW-специфічні кольори (НЕ дизайн-токени)

Фіксовані кольори якості предметів/грошей клієнта WotLK (тултіп предметів,
`.raid-rarity--*`) — власний `:root`-блок **окремо** від секції DESIGN TOKENS
у `style.css` (коментар "WoW game constants"), бо тема сайту їх ніколи не
повинна чіпати:

| Змінна | Значення | Де |
|---|---|---|
| `--wow-quality-poor` | #9d9d9d | `.q0` |
| `--wow-quality-common` | #ffffff | `.q1`, `.raid-rarity--common` |
| `--wow-quality-uncommon` | #1eff00 | `.q2`, `.raid-rarity--uncommon` |
| `--wow-quality-rare` | #0070dd | `.q3`, `.raid-rarity--rare` |
| `--wow-quality-epic` | #a335ee | `.q4`, `.raid-rarity--epic` |
| `--wow-quality-legendary` | #ff8000 | `.q5` |
| `--wow-quality-artifact` | #e6cc80 | `.q6` |
| `--wow-quality-heirloom` | #00ccff | `.q7` |
| `--wow-money-gold` / `-silver` / `-copper` | #ffd700 / #c0c0c0 / #b87333 | `.moneygold`/`.moneysilver`/`.moneycopper` |

Юзай ці токени, а не сирі hex — вони й так дублювались між `.q*` і
`.raid-rarity--*`, звідси й токенізація. Але ніколи не заміняй їх на
`--color-*` дизайн-токени сайту, навіть якщо значення випадково збіглось
(напр. `--color-link-hover` теж #ffd700) — семантика різна.

---

## Іконки — тільки Primer Octicons

Усі SVG-іконки на сайті беремо з бібліотеки [Primer Octicons](https://github.com/primer/octicons)
(той самий проєкт, що дав дизайн-токени вище) — **ніколи не малюй іконку
вручну** (ні stroke-based "feather"-стиль, ні довільні path).

Формат Octicons: `viewBox="0 0 16 16"`, `fill="currentColor"`, один або
кілька `<path>` без `stroke`. Приклад (навбар вже так робить, `index.html`):
```html
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
  <path d="..."/>
</svg>
```

**Як дістати потрібну іконку:** через GitHub API репозиторію `primer/octicons`
(файли `icons/<name>-16.svg`, decode base64):
```bash
gh api repos/primer/octicons/contents/icons/gift-16.svg --jq '.content' | base64 -d
```
Або пошук назви на https://primer.style/foundations/icons.

> **Історичний виняток:** приклад "Іконка-видалення" нижче (кошик,
> `.account-delete-btn`) намальований вручну до введення цього правила —
> НЕ копіюй його SVG як зразок для нових кнопок, копіюй тільки CSS-клас.
> Для нового кошика бери Octicons `trash-16`.

---

## Тултіпи — тільки `.tooltipped` (Primer-стиль), ніколи нативний `title`

Єдиний дозволений спосіб підказки при наведенні — клас `.tooltipped` +
`aria-label` (CSS `::before`/`::after` в `style.css`, секція TOOLTIP):
```html
<button type="button" class="raid-icon-btn tooltipped" aria-label="Текст підказки">…</button>
```
`aria-label` — єдине джерело тексту (і для screen reader, і для CSS-контенту
`.tooltipped::after`). **Ніколи не додавай атрибут `title` поруч** —
браузер покаже свій нативний тултіп ПОВЕРХ кастомного, і користувач побачить
два підписи одночасно (це баг, перевіряй при рев'ю).

Якщо `.tooltipped::after` візуально обрізається `overflow:hidden`
батьківського контейнера — це НЕ привід повертати `title` як "фолбек".
Правильний фікс: `position: fixed` JS-тултіп, що позиціонується через
`getBoundingClientRect()` елемента при `mouseenter`/`focus` — той самий
прийом, що вже реалізований для `#raidItemTooltip` і `#raidBtnTooltip`
(`scripts/raid-manager-detail.js`): `position: fixed` рендериться відносно
viewport і не залежить від `overflow` жодного предка.

Перед рев'ю нового `.tooltipped`-елемента — grep на `title=` поруч із ним,
щоб не пропустити дублікат.

---

## Правило скопінгу CSS

**Майже всі page-specific класи мають префікс `body.<page>-page`**, наприклад:
```css
body.account-page .my-component { … }
body.raid-manager-detail-page .raid-officer-panel { … }
```
Глобальні класи (без page-prefix) — лише для елементів, що реально використовуються на кількох сторінках (`.compare-btn`, `.player-badge`, `.ranking-table-wrap`, `.raid-chip` тощо).

---

## Кнопки

### Первинна / CTA: `.compare-btn`
```css
padding: 0.5rem 1rem;
border: 1px solid rgba(255, 255, 255, 0.28);
border-radius: var(--radius-md);
background: var(--color-surface-soft);
color: var(--color-text-strong);
font-size: 0.95rem;
font-weight: 500;
cursor: pointer;
transition: background var(--transition-fast), border-color var(--transition-fast);
/* :hover */ background: var(--color-surface-soft-hover); border-color: rgba(255,255,255,0.45);
/* :disabled */ opacity: 0.45; cursor: not-allowed;
```

### Посилання-кнопка: `.link-button-std`
```css
background: none;
border: 1px solid var(--color-border-mid);
border-radius: var(--radius-md);
padding: 0.25rem 0.6rem;
color: var(--color-link);
font-size: 0.8rem;
cursor: pointer;
/* :hover */ background-color: var(--color-hover);
/* --danger modifier */ color: var(--color-danger); border-color: rgba(255,107,107,0.4); bg: rgba(255,107,107,0.12);
```

### Іконка-видалення: `.account-delete-btn` / `.archive-delete-btn`
```css
background: none; border: none; padding: 0.4rem;
color: var(--color-text-muted); cursor: pointer;
border-radius: var(--radius-md); display: inline-flex; align-items: center;
/* :hover */ color: var(--color-danger); background-color: rgba(255,107,107,0.12);
```
SVG-іконка: `width="16" height="16"`, кошик (polyline 3 6 5 6 21 6 + paths).

**Обов'язково:** `aria-label="Видалити"` на кнопці — браузер показує його як тултіп при наведенні, і це доступність (screen reader). Без видимого тексту на кнопці — `aria-label` є єдиним підписом.

```html
<button type="button" class="account-delete-btn" aria-label="Видалити">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
</button>
```
> Клас `account-delete-btn` — scoped до `body.account-page`; для інших сторінок створюй аналогічний page-scoped клас (напр. `archive-delete-btn` для `body.raid-manager-page`).

### Primary submit (зелена): `.compare-btn` у контексті `.raid-soft-form`

Кнопка підтвердження дії (наприклад "Засофтити", "Призначити софт") — зелена, суцільна, виділяється серед нейтральних кнопок. Застосовується через page-scoped override поверх базового `.compare-btn`:

```css
body.raid-manager-detail-page .raid-soft-form button[type="submit"].compare-btn {
  background: var(--color-success-strong);
  border-color: var(--color-success-strong);
  color: var(--color-on-accent);
}
body.raid-manager-detail-page .raid-soft-form button[type="submit"].compare-btn:hover:not(:disabled) {
  background: var(--color-success-strong-hover);
  border-color: var(--color-success-strong-hover);
}
```

> `--color-success-strong` — окремий токен від `--color-success` (не той самий, затемнений вручну), бо як суцільний фон кнопки `--color-success` виглядав би занадто яскраво. Аналогічно для danger-кнопок: фон — `var(--color-danger)`, hover — `var(--color-danger-hover)`.

### Тогл-кнопки: `.raid-toggle-btn` / `.raid-weight-toggle-btn`
```css
padding: 0.35rem 0.7rem;
border: 1px solid rgba(197, 198, 205, 0.35);
border-radius: var(--radius-sm);
background-color: rgba(12, 21, 33, 0.88);
color: var(--color-text-strong);
font-size: 0.85rem; font-weight: 600;
cursor: pointer;
transition: border-color, background-color, color — var(--transition-fast);
/* :hover */ border-color: rgba(123,170,245,0.55);
/* --active */ background: var(--color-accent-gold); border-color: var(--color-accent-gold); color: var(--color-surface-solid);
```

---

## Пагінація

Єдиний паттерн для всіх сторінок — клас `.raid-pagination` (глобальний, не page-scoped).

### HTML
```html
<div id="myPagination" class="raid-pagination" hidden>
  <button type="button" id="prevBtn" class="link-button-std">← Попередня</button>
  <span id="pageInfo"></span>
  <button type="button" id="nextBtn" class="link-button-std">Наступна →</button>
</div>
```

### CSS (вже в `style.css`)
```css
.raid-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.75rem;
}
.raid-pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

> **Увага:** `.raid-pagination { display: flex; }` перекриває атрибут `[hidden]`. Якщо треба коректний show/hide через `element.hidden`, використовуй патерн:
> ```css
> .raid-pagination { display: none; }
> .raid-pagination:not([hidden]) { display: flex; align-items: center; justify-content: center; gap: 1rem; }
> ```

### JS — типовий патерн
```js
function renderPagination(totalPages) {
  paginationEl.hidden = totalPages <= 1;
  pageInfoEl.textContent = `Сторінка ${currentPage} з ${totalPages}`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
}
```

Кнопки — `.link-button-std` (маленькі, без фону, колір `var(--color-link)`). Текст сторінки — звичайний `<span>` без класу.

---

## Поля вводу та `<select>`

Єдиний паттерн для всіх текстових полів і дропдаунів:
```css
padding: 0.45rem 0.65rem;
border: 1px solid rgba(197, 198, 205, 0.35);
border-radius: var(--radius-sm);
background-color: rgba(12, 21, 33, 0.88);
color: var(--color-text-strong);
font-size: 0.95rem;
outline: none;
transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
/* :hover */ border-color: rgba(123,170,245,0.55);
/* :focus */ border-color: var(--color-link); box-shadow: 0 0 0 2px rgba(123,170,245,0.18);
/* :disabled */ opacity: 0.45; cursor: not-allowed;
```

### Стрілка `<select>` і кастомних тригерів

Всі дропдауни повинні мати **однаковий** шеврон. Ніколи не залишай нативну браузерну стрілку на `<select>` поряд із кастомними тригерами — вони виглядають по-різному.

**Для `<select>`:**
```css
appearance: none;
padding-right: 2rem;
background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23a0a8b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M4 6l4 4 4-4'/%3e%3c/svg%3e");
background-repeat: no-repeat;
background-position: right 0.65rem center;
background-size: 0.65rem;
```

**Для кастомного тригера (`::after`):**
```css
content: '';
flex-shrink: 0;
margin-left: auto;
width: 0.65rem;
height: 0.65rem;
background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23a0a8b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M4 6l4 4 4-4'/%3e%3c/svg%3e");
background-repeat: no-repeat;
background-size: contain;
background-position: center;
```
> Колір стрілки `%23a0a8b8` = `#a0a8b8` ≈ `--color-text-faint`. Не використовуй символ `▾` — він відрізняється від шеврона.

---

## Вкладки (tabs)

Використовується на raid-detail і account page. Клас `.raid-tabs` / `.raid-tab`:
```css
/* Контейнер */
display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;
margin: 1rem 0 0.75rem;
border-bottom: 1px solid var(--color-border);

/* Кнопка вкладки */
background: none; border: none;
padding: 0.5rem 0.9rem;
margin-bottom: -1px;
border-bottom: 2px solid transparent;
color: var(--color-text-faint);
font-size: 0.9rem; font-weight: 500; cursor: pointer;
/* :hover */ color: var(--color-text-strong);
/* --active */ color: var(--color-text-strong); border-bottom-color: var(--color-link);
```
> **Не дублюй** цей паттерн окремими класами — розшир існуючий селектор `body.account-page .raid-tabs` або `body.raid-manager-detail-page .raid-tabs`.

---

## Автодоповнення (autocomplete dropdown)

Паттерн `.raid-autocomplete-list` / `.raid-autocomplete-item`:
```css
/* Список */
position: absolute; top: 100%; left: 0; right: 0;
z-index: 20; margin-top: 0.25rem;
max-height: 18.75rem; overflow-y: auto;
border: 1px solid rgba(197,198,205,0.35);
border-radius: var(--radius-sm);
background-color: rgba(12,21,33,0.97);
box-shadow: var(--shadow-sm);
display: none; /* показуй класом .is-open */

/* Елемент */
padding: 0.3rem 0.65rem;
font-size: 0.85rem; color: var(--color-text-strong); cursor: pointer;
/* :hover */ background-color: rgba(123,170,245,0.18);
```
Обгортка `.raid-input-wrap` — `position: relative; width: 100%` — завжди потрібна для абсолютного позиціонування списку.

---

## Таблиці

Контейнер `.ranking-table-wrap`:
```css
border: 1px solid var(--color-border-mid);
border-radius: var(--radius-md);
background-color: var(--color-surface-table);
overflow: visible; /* або overflow-x: auto для широких */
```

Таблиця (`.account-characters-table`, `.raid-table` тощо):
```css
width: 100%; border-collapse: collapse;
/* th+td */ padding: 0.3rem–0.6rem; border-bottom: 1px solid var(--color-border); text-align: left; font-size: 0.82–0.85rem;
/* th */ color: var(--color-text-strong); font-weight: 500;
/* tbody tr:hover */ background-color: var(--color-hover);
/* last-child td */ border-bottom: none;
```

---

## Клікабельні рядки таблиці ("stretched link")

Коли весь `<tr>` має вести на іншу сторінку (напр. "Архів рейдів" →
конкретний рейд) — **ніколи не вішай `onclick`/навігацію на `<tr>`**:
неможливо відкрити в новій вкладці ctrl/middle-click, клавіатура й
скрінрідер не бачать рядок як інтерактивний елемент. Замість цього —
розтягуємо вже наявний справжній `<a>` у клітинці на весь рядок через
`::after`.

### JS — додай клас на вже існуючий `<a>` у клітинці
```js
const link = document.createElement('a');
link.className = 'archive-row-link'; // page-scoped назва під конкретну таблицю
link.href = `../raid/?id=${encodeURIComponent(raid.id)}`;
link.textContent = raid.title;
```

### CSS
```css
body.<page>-page #myTable tbody tr {
  position: relative; /* containing block для ::after */
  cursor: pointer;
}

body.<page>-page .archive-row-link::after {
  content: '';
  position: absolute;
  inset: 0; /* перекриває весь <tr>, не лише свою <td> */
}
```
`position: relative` на `<tr>` коректно працює в усіх сучасних браузерах
(row-box охоплює всі колонки) — не потрібен обгортковий `<div>`.

**Якщо в рядку є ще одна інтерактивна кнопка** (напр. видалити) —
підніми її над розтягнутим лінком, інакше клік по ній проковтне
overlay:
```css
body.<page>-page .archive-delete-btn {
  position: relative;
  z-index: 1;
}
```

Готовий приклад — "Архів рейдів" (`scripts/raid-manager-archive.js`,
`.archive-row-link` / `.archive-delete-btn` у `style.css`).

---

## Чіпи / бейджі

`.raid-chip` (статус/інфо):
```css
padding: 0.15rem 0.55rem;
border-radius: var(--radius-pill);
font-size: 0.75rem; font-weight: 500; white-space: nowrap;
border: 1px solid var(--color-border-mid);
color: var(--color-text-faint);
background-color: var(--color-surface-soft);
/* --active */ color: var(--color-success); border: rgba(99,212,113,0.4); bg: rgba(99,212,113,0.12);
/* --danger / error */ color: var(--color-danger); border: rgba(255,107,107,0.4); bg: rgba(255,107,107,0.12);
```

`.player-badge` (гравець — гільдієць/легіонер): глобальний клас, не дублюй.

---

## Форма з мітками (grid-layout)

```css
display: grid;
grid-template-columns: auto 1fr; /* або: 1fr auto для input+button */
gap: 0.5rem 0.75rem;
align-items: center;
max-width: 480px;
```

---

## Чеклист перед додаванням нового UI-елемента

1. **Чи існує вже такий елемент** у `style.css`? Перевір через grep за типом (tab, autocomplete, chip, input, button).
2. **Використовуй токени**, не хардкодь кольори/радіуси/відступи.
3. **Page-scope**: новий клас — під `body.<page>-page .class`, якщо не глобальний.
4. **Не дублюй** `.raid-tabs`, `.raid-autocomplete-list`, `.compare-btn` тощо — розшир існуючий селектор.
5. Hover/focus/disabled — обов'язково для будь-якого інтерактивного елемента.
6. Мінімальна висота кліку для кнопок — `min-height: 44px` (стандарт доступності) або `padding` що дає ≥ 44px hit-area.
