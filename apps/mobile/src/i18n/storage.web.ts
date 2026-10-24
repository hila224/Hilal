const KEY = 'hilal.langue';

export async function loadLanguage() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveLanguage(code: string) {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
}
