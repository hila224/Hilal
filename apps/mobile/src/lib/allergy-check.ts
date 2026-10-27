// Contrôle indicatif des allergies au moment de prescrire : nom identique, ou même
// famille de médicaments (ex. allergie aux sulfamides et sulfadoxine-pyriméthamine).
// Il ne remplace pas la vérification du médecin.

/** Familles de médicaments courantes : nom de la famille et principales molécules ou marques. */
const DRUG_CLASSES: string[][] = [
  ['sulfamide', 'sulfonamide', 'sulfa', 'sulfadoxine', 'sulfamethoxazole', 'cotrimoxazole', 'co-trimoxazole', 'bactrim', 'fansidar', 'sulfadiazine', 'sulfasalazine'],
  ['penicilline', 'amoxicilline', 'ampicilline', 'oxacilline', 'cloxacilline', 'augmentin', 'benzathine', 'extencilline', 'piperacilline'],
  ['cephalosporine', 'ceftriaxone', 'cefixime', 'cefuroxime', 'cefalexine', 'cefotaxime', 'cefazoline', 'cefpodoxime'],
  ['ains', 'anti-inflammatoire', 'ibuprofene', 'diclofenac', 'ketoprofene', 'naproxene', 'aspirine', 'acetylsalicylique', 'indometacine', 'piroxicam', 'meloxicam'],
  ['quinolone', 'fluoroquinolone', 'ciprofloxacine', 'ofloxacine', 'levofloxacine', 'norfloxacine'],
  ['macrolide', 'erythromycine', 'azithromycine', 'clarithromycine'],
];

/** Minuscules, sans accents, pluriel simple retiré (« Sulfamides » → « sulfamide »). */
export const normalizeDrug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/s\b/g, '');

const FAMILIES = DRUG_CLASSES.map((family) => family.map(normalizeDrug));

/** Termes à rechercher dans un médicament pour une allergie donnée. */
function termsFor(substance: string): string[] {
  const allergy = normalizeDrug(substance);
  const terms = new Set([allergy]);
  for (const family of FAMILIES) {
    if (family.some((member) => allergy.includes(member) || (allergy.length >= 4 && member.includes(allergy)))) {
      family.forEach((member) => terms.add(member));
    }
  }
  return [...terms].filter((term) => term.length >= 4);
}

/** Première allergie qui semble concerner ce médicament, s'il y en a une. */
export function matchingAllergy<T extends { substance: string }>(medicine: string, allergies: T[]): T | undefined {
  const name = normalizeDrug(medicine);
  if (name.length < 3) return undefined;
  const firstWord = name.split(/[\s/]+/)[0] ?? '';
  return allergies.find((allergy) =>
    termsFor(allergy.substance).some((term) => name.includes(term) || (firstWord.length >= 4 && term.includes(firstWord)))
  );
}
