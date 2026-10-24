import 'i18next';

import type { Translations } from './fr';

// Clés de traduction vérifiées par TypeScript : une faute de frappe dans t('…') ne compile pas.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
  }
}
