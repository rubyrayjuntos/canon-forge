/**
 * Keep the current model when it is in the live catalog; otherwise pick the first.
 * @param {string} currentModel
 * @param {{ id: string }[] | undefined} models
 * @returns {string | null}
 */
export function pickFirstModelIfMissing(currentModel, models) {
  if (!Array.isArray(models) || models.length === 0) return null;
  if (models.some((m) => m.id === currentModel)) return null;
  return models[0].id;
}
