-- Обраний фон сайту. Зберігаємо ім'я файлу з images/backgrounds/, а не
-- індекс маніфесту: індекс зсувається при додаванні нового фону і в усіх
-- користувачів мовчки помінялась би картинка.
--   NULL   - стандартний фон (default.jpg)
--   'none' - без фону, суцільний --color-page-bg
ALTER TABLE users ADD COLUMN background TEXT;
