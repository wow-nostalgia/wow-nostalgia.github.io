# Рейтинг Потів

1. Додай нове посилання на лог в `data/raid-logs.json`.
2. В консолі запусти команду `npm run update:potions`.
   cd "c:\Work\wow-nostalgia.github.io"
   npm run update:potions

3. В консолі запусти команду `npm run update:personal` — скрипт перепише `data/personal-stats.json` (дані для розділу "Персональна Аналітика": DPS гравців по кожному босу за цей рейд).

   Скрипт сам пам'ятає, які рейди вже обробив — щодня запускати на всі рейди не треба, обробиться лише новододаний лог (секунди). Лише першого разу повний прохід по всіх рейдах займає ~30-40 хвилин.

Рейтинг гравців оновлюється автоматично кожен ранок. Є спеціальний Action: <https://github.com/wow-nostalgia/wow-nostalgia.github.io/actions/workflows/update-guild-data.yml>

Єдине, що список согільдійців треба заливати (оновлювати вручну). Для цього є спеціальний аддон для експорту списку гравців гільдії. Він лежить в папці `Addon-to-export-guild-members`. Читай `ReadMe` всередині аддону.

## Як оновити список гравців

1. В грі виконай команду `/groster` (аддон GuildRosterExportMini).
2. Скопіюй файл `World of Warcraft\WTF\Account\<ТВІЙ_АКАУНТ>\SavedVariables\GuildRosterExportMini.lua` в корінь проєкту.
3. В консолі запусти команду `npm run update:players` — скрипт перепише `data/players.json`.

# Галерея

1. Додай нові скріншоти.
2. Запусти команду у консолі: `node scripts/build-gallery.js`.
