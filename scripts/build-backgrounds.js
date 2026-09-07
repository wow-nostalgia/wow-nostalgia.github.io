'use strict';

// Генерує маніфест фонів сайту + мініатюри для сітки вибору у профілі.
// Аналог build-gallery.js, але з ресайзом: оригінали фонів важать сотні
// кілобайт, а на сторінці профілю їх показується десяток одночасно.

const fs = require('node:fs/promises');
const path = require('path');
const sharp = require('sharp');

const BACKGROUNDS_DIR = path.join(__dirname, '..', 'images', 'backgrounds');
const THUMBS_DIR = path.join(BACKGROUNDS_DIR, 'thumbs');
const OUTPUT_FILE = path.join(BACKGROUNDS_DIR, 'backgrounds.json');

const DEFAULT_FILE = 'default.jpg';
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 70;

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

// Імена, які самі по собі читаються погано (файл технічний, не змістовний).
const TITLE_OVERRIDES = {
  default: 'Стандартний'
};

function toTitle(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  if (TITLE_OVERRIDES[base]) return TITLE_OVERRIDES[base];

  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodePath(fileName) {
  return encodeURIComponent(fileName).replace(/%2F/g, '/');
}

function thumbName(fileName) {
  return `${path.basename(fileName, path.extname(fileName))}.webp`;
}

// Мініатюру перегенеровуємо лише якщо оригінал новіший — інакше кожен
// прогін переписував би всі файли й засмічував git diff.
async function needsThumb(sourcePath, thumbPath) {
  try {
    const [source, thumb] = await Promise.all([fs.stat(sourcePath), fs.stat(thumbPath)]);
    return source.mtimeMs > thumb.mtimeMs;
  } catch {
    return true;
  }
}

async function buildThumb(fileName) {
  const sourcePath = path.join(BACKGROUNDS_DIR, fileName);
  const thumbPath = path.join(THUMBS_DIR, thumbName(fileName));

  if (!(await needsThumb(sourcePath, thumbPath))) return false;

  await sharp(sourcePath)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toFile(thumbPath);

  return true;
}

// Мініатюри без оригіналу лишаються після видалення/перейменування фону —
// прибираємо, щоб папка не накопичувала сміття.
async function pruneOrphanThumbs(keepNames) {
  let entries;
  try {
    entries = await fs.readdir(THUMBS_DIR, { withFileTypes: true });
  } catch {
    return 0;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || keepNames.has(entry.name)) continue;
    await fs.unlink(path.join(THUMBS_DIR, entry.name));
    removed += 1;
  }

  return removed;
}

async function buildBackgroundsManifest() {
  let entries;
  try {
    entries = await fs.readdir(BACKGROUNDS_DIR, { withFileTypes: true });
  } catch {
    throw new Error(`Папка не знайдена: ${BACKGROUNDS_DIR}`);
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((a, b) => {
      // Стандартний фон завжди перший у сітці вибору.
      if (a === DEFAULT_FILE) return -1;
      if (b === DEFAULT_FILE) return 1;
      return a.localeCompare(b, 'uk');
    });

  if (!files.length) throw new Error(`У папці ${BACKGROUNDS_DIR} немає зображень`);
  if (!files.includes(DEFAULT_FILE)) {
    throw new Error(`Відсутній стандартний фон ${DEFAULT_FILE} — на нього падає сайт, коли вибір не зроблено`);
  }

  await fs.mkdir(THUMBS_DIR, { recursive: true });

  const manifest = [];
  let built = 0;

  for (const fileName of files) {
    if (await buildThumb(fileName)) built += 1;

    manifest.push({
      file: fileName,
      src: `/images/backgrounds/${encodePath(fileName)}`,
      thumb: `/images/backgrounds/thumbs/${encodePath(thumbName(fileName))}`,
      title: toTitle(fileName),
      isDefault: fileName === DEFAULT_FILE
    });
  }

  const removed = await pruneOrphanThumbs(new Set(files.map(thumbName)));

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Готово. Фонів: ${manifest.length}, згенеровано мініатюр: ${built}, прибрано зайвих: ${removed}.`);
  console.log(`Маніфест записано у: ${OUTPUT_FILE}`);
}

buildBackgroundsManifest().catch((error) => {
  console.error('Помилка генерації backgrounds.json');
  console.error(error.message);
  process.exit(1);
});
