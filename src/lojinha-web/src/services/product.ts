export function generateSkuFromName(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return normalized;
}

export function minutesToDurationParts(totalMinutes: number) {
  const totalSeconds = Math.max(0, Math.round(totalMinutes * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds };
}

export function durationPartsToMinutes(hours: number, minutes: number, seconds: number) {
  const safeHours = Math.max(0, hours);
  const safeMinutes = Math.max(0, minutes);
  const safeSeconds = Math.max(0, seconds);

  return (safeHours * 3600 + safeMinutes * 60 + safeSeconds) / 60;
}