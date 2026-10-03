export const AIRPORT_CATEGORIES = {
  regional: 'Regional', military: 'Military', business: 'Business aviation',
  passenger: 'Passenger', cargo: 'Cargo', rescue: 'Rescue', naval: 'Naval aviation'
} as const;
export type AirportCategory = keyof typeof AIRPORT_CATEGORIES;
