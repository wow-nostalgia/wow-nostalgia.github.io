-- Обрана тема сайту (профіль -> Налаштування -> Тема сайту).
--   NULL   - стандартна тема
--   'atom' - темна (Atom One Cyan), :root[data-theme="atom"] у style.css
ALTER TABLE users ADD COLUMN theme TEXT;
