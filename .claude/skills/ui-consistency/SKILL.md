# UI Consistency — wow-nostalgia.github.io

## Коли застосовувати

- Проектуєш новий UI-елемент (кнопка, поле вводу, вкладка, дропдаун, таблиця, чіп, список)
- Додаєш нові CSS-класи до `style.css`
- Рецензуєш існуючі елементи на предмет відхилення від паттерну

---

## Дизайн-токени (завжди використовуй, не хардкодь)

| Категорія | Змінні |
|---|---|
| Кольори тексту | `--color-text`, `--color-text-strong`, `--color-text-soft`, `--color-text-muted`, `--color-text-faint` |
| Поверхні | `--color-surface`, `--color-surface-soft`, `--color-surface-overlay`, `--color-surface-table` |
| Бордюри | `--color-border`, `--color-border-soft`, `--color-border-mid`, `--color-border-strong`, `--color-border-accent` |
| Стани hover/active | `--color-hover`, `--color-hover-strong`, `--color-active` |
| Акценти | `--color-link` (#7baaf5), `--color-link-hover` (#ffd700), `--color-brand`, `--color-accent-gold`, `--color-accent-purple` |
| Семантика | `--color-success` (#63d471), `--color-danger` (#ff6b6b) |
| Радіуси | `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (10px), `--radius-xl` (14px), `--radius-pill` (999px) |
| Тіні | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Анімація | `--transition-fast` (0.2s ease) |
| Відступи | `--space-1`…`--space-9` (0.15rem…2rem) |

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
/* --danger modifier */ color: --color-danger; border-color: rgba(255,107,107,0.4); bg: rgba(255,107,107,0.12);
```

### Іконка-видалення: `.account-delete-btn` / `.archive-delete-btn`
```css
background: none; border: none; padding: 0.4rem;
color: var(--color-text-faint); cursor: pointer;
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
/* --active */ background: var(--color-accent-gold); border-color: var(--color-accent-gold); color: #1d2636;
```

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

## Чіпи / бейджі

`.raid-chip` (статус/інфо):
```css
padding: 0.15rem 0.55rem;
border-radius: var(--radius-pill);
font-size: 0.75rem; font-weight: 500; white-space: nowrap;
border: 1px solid var(--color-border-mid);
color: var(--color-text-faint);
background-color: var(--color-surface-soft);
/* --active */ color: --color-success; border: rgba(99,212,113,0.4); bg: rgba(99,212,113,0.12);
/* --danger / error */ color: --color-danger; border: rgba(255,107,107,0.4); bg: rgba(255,107,107,0.12);
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
