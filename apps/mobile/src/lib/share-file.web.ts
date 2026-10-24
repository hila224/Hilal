/** Sur le web : téléchargement direct du fichier. */
export async function shareTextFile(fileName: string, content: string, _title: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
