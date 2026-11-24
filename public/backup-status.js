// Estado local de backup. Não faz parte do JSON exportado pelo aluno.
export function hasMeaningfulData(data, defaults) {
  return ['ingredients', 'recipes', 'recipeItems', 'fixedExpenses', 'marketPrices']
    .some(key => Array.isArray(data[key]) && data[key].length > 0)
    || Object.keys(defaults).some(key => data.settings?.[key] !== defaults[key]);
}
export function normalizeBackupMeta(raw, hasData) {
  if (raw && Number.isSafeInteger(raw.revision) && raw.revision >= 0
    && Number.isSafeInteger(raw.backedUpRevision) && raw.backedUpRevision >= 0) {
    return {revision: raw.revision, backedUpRevision: raw.backedUpRevision,
      lastBackupAt: typeof raw.lastBackupAt === 'string' ? raw.lastBackupAt : null};
  }
  return {revision: hasData ? 1 : 0, backedUpRevision: 0, lastBackupAt: null};
}
export function backupPending(meta, hasData) {
  return Boolean(hasData && meta.revision !== meta.backedUpRevision);
}
export function nextRevision(meta) { return {...meta, revision: meta.revision + 1}; }
export function markBackup(meta, timestamp) {
  return {...meta, backedUpRevision: meta.revision, lastBackupAt: timestamp};
}
