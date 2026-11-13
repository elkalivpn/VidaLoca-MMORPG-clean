export const ZONE_VIBES: Record<string, string> = {
  madrid_centro: 'business',
  malasana: 'nightlife',
  salamanca: 'luxury',
  barcelona_ramblas: 'street',
  barcelona_gotico: 'street',
  marbella_centro: 'luxury',
  puerto_banus: 'luxury',
  sevilla_casco: 'street',
  valencia_artes: 'business',
  bilbao_casco: 'street',
};

export const VALID_ZONE_IDS = Object.keys(ZONE_VIBES);

export function isValidZoneId(locationId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ZONE_VIBES, locationId);
}
