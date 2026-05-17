'use strict';

const fs = require('node:fs/promises');
const path = require('path');

const GALLERY_DIR = path.join(__dirname, '..', 'images', 'gallery');
const OUTPUT_FILE = path.join(GALLERY_DIR, 'gallery.json');

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif'
]);

function toTitle(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildGalleryManifest() {
  let entries;
  try {
    entries = await fs.readdir(GALLERY_DIR, { withFileTypes: true });
  } catch {
    throw new Error(`Папка не знайдена: ${GALLERY_DIR}`);
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => ALLOWED_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .filter((fileName) => fileName.toLowerCase() !== 'gallery.json')
    .sort((a, b) => a.localeCompare(b, 'uk'));

  const manifest = files.map((fileName, index) => {
    const title = toTitle(fileName);

    return {
      id: index + 1,
      src: `/images/gallery/${encodeURIComponent(fileName).replace(/%2F/g, '/')}`,
      fileName,
      title,
      alt: title
    };
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Готово. Знайдено ${manifest.length} зображень.`);
  console.log(`Маніфест записано у: ${OUTPUT_FILE}`);
}

buildGalleryManifest().catch((error) => {
  console.error('Помилка генерації gallery.json');
  console.error(error.message);
  process.exit(1);
});
