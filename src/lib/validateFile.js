const PHOTO_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const AUDIO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"];

/**
 * Валидация файла перед загрузкой.
 * @param {File} file
 * @param {"photo"|"audio"} type
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateFile(file, type) {
  if (type === "photo") {
    if (!PHOTO_TYPES.includes(file.type)) {
      return { ok: false, error: `Неподдерживаемый формат: ${file.type}. Допустимы: JPEG, PNG, WebP` };
    }
    if (file.size > PHOTO_MAX_SIZE) {
      return { ok: false, error: `Фото слишком большое: ${(file.size / 1024 / 1024).toFixed(1)} МБ (макс. 10 МБ)` };
    }
  } else if (type === "audio") {
    if (!AUDIO_TYPES.includes(file.type)) {
      return { ok: false, error: `Неподдерживаемый формат: ${file.type}. Допустимы: MP3, WAV, OGG` };
    }
    if (file.size > AUDIO_MAX_SIZE) {
      return { ok: false, error: `Аудио слишком большое: ${(file.size / 1024 / 1024).toFixed(1)} МБ (макс. 50 МБ)` };
    }
  }
  return { ok: true };
}
