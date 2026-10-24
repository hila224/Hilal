// Les rappels de médicaments n'existent que sur téléphone (iOS / Android).
export const notificationsAllowed = async () => false;
export const requestNotificationPermission = async () => false;
export const syncMedicationReminders = async () => {};
