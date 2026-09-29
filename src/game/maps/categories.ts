export const AIRPORT_CATEGORIES = {
  regional: 'Regional', military: 'Military', business: 'Business aviation',
  passenger: 'Passenger', cargo: 'Cargo', rescue: 'Rescue'
} as const;
export type AirportCategory = keyof typeof AIRPORT_CATEGORIES;
