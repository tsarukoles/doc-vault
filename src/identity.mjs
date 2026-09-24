export const PRODUCT = 'edw-doc';

// Older owned vaults remain valid. Fresh output uses the new product name;
// reading an existing marker never rewrites repository files.
export const ownsVault = marker => marker?.product === PRODUCT || marker?.product === 'doc-vault';
export const ownsMaintenance = marker => marker?.product === `${PRODUCT}-maintenance` || marker?.product === 'doc-vault-maintenance';

export function configurationEnvironment(env = process.env) {
  const setting = (current, legacy) => {
    const value = env[current] || undefined, previous = env[legacy] || undefined;
    if (value && previous && value !== previous) throw new Error(`${current} conflicts with legacy ${legacy}. Align or remove the old setting before running EDW Doc.`);
    return value || previous;
  };
  return { root: setting('EDW_DOC_ROOT', 'DOC_VAULT_ROOT'), vaultName: setting('EDW_DOC_NAME', 'DOC_VAULT_NAME') };
}
