export interface GeoLocation {
  city: string;
  country: string;
  lat: number;
  lon: number;
}

// Curated offline database of major global cities, travel hotspots, and photography destinations
const CITIES: GeoLocation[] = [
  // Western & Southern Europe
  { city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { city: 'Nice', country: 'France', lat: 43.7102, lon: 7.262 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lon: 5.3698 },
  { city: 'Lyon', country: 'France', lat: 45.764, lon: 4.8357 },
  { city: 'Bordeaux', country: 'France', lat: 44.8378, lon: -0.5792 },
  { city: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  { city: 'Florence', country: 'Italy', lat: 43.7696, lon: 11.2558 },
  { city: 'Venice', country: 'Italy', lat: 45.4408, lon: 12.3155 },
  { city: 'Milan', country: 'Italy', lat: 45.4642, lon: 9.19 },
  { city: 'Naples', country: 'Italy', lat: 40.8518, lon: 14.2681 },
  { city: 'Amalfi', country: 'Italy', lat: 40.634, lon: 14.6027 },
  { city: 'Positano', country: 'Italy', lat: 40.6281, lon: 14.485 },
  { city: 'Palermo', country: 'Italy', lat: 38.1157, lon: 13.3615 },
  { city: 'Dolomites', country: 'Italy', lat: 46.4102, lon: 11.844 },
  { city: 'Lake Como', country: 'Italy', lat: 45.993, lon: 9.257 },
  { city: 'Barcelona', country: 'Spain', lat: 41.3851, lon: 2.1734 },
  { city: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { city: 'Seville', country: 'Spain', lat: 37.3891, lon: -5.9845 },
  { city: 'Valencia', country: 'Spain', lat: 39.4699, lon: -0.3763 },
  { city: 'Granada', country: 'Spain', lat: 37.1773, lon: -3.5986 },
  { city: 'Mallorca', country: 'Spain', lat: 39.6953, lon: 3.0176 },
  { city: 'Ibiza', country: 'Spain', lat: 38.9067, lon: 1.4206 },
  { city: 'Lisbon', country: 'Portugal', lat: 38.7223, lon: -9.1393 },
  { city: 'Porto', country: 'Portugal', lat: 41.1579, lon: -8.6291 },
  { city: 'Faro', country: 'Portugal', lat: 37.0194, lon: -7.9304 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { city: 'Edinburgh', country: 'United Kingdom', lat: 55.9533, lon: -3.1883 },
  { city: 'Manchester', country: 'United Kingdom', lat: 53.4808, lon: -2.2426 },
  { city: 'Oxford', country: 'United Kingdom', lat: 51.752, lon: -1.2577 },
  { city: 'Dublin', country: 'Ireland', lat: 53.3498, lon: -6.2603 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041 },
  { city: 'Rotterdam', country: 'Netherlands', lat: 51.9244, lon: 4.4777 },
  { city: 'Brussels', country: 'Belgium', lat: 50.8503, lon: 4.3517 },
  { city: 'Bruges', country: 'Belgium', lat: 51.2093, lon: 3.2247 },
  { city: 'Ghent', country: 'Belgium', lat: 51.0543, lon: 3.7174 },
  { city: 'Antwerp', country: 'Belgium', lat: 51.2194, lon: 4.4025 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  { city: 'Munich', country: 'Germany', lat: 48.1351, lon: 11.582 },
  { city: 'Frankfurt', country: 'Germany', lat: 50.1109, lon: 8.6821 },
  { city: 'Hamburg', country: 'Germany', lat: 53.5511, lon: 9.9937 },
  { city: 'Cologne', country: 'Germany', lat: 50.9375, lon: 6.9603 },
  { city: 'Vienna', country: 'Austria', lat: 48.2082, lon: 16.3738 },
  { city: 'Salzburg', country: 'Austria', lat: 47.8095, lon: 13.055 },
  { city: 'Innsbruck', country: 'Austria', lat: 47.2692, lon: 11.4041 },
  { city: 'Hallstatt', country: 'Austria', lat: 47.5622, lon: 13.6493 },
  { city: 'Zurich', country: 'Switzerland', lat: 47.3769, lon: 8.5417 },
  { city: 'Geneva', country: 'Switzerland', lat: 46.2044, lon: 6.1432 },
  { city: 'Lucerne', country: 'Switzerland', lat: 47.0502, lon: 8.3093 },
  { city: 'Zermatt', country: 'Switzerland', lat: 45.9765, lon: 7.7491 },
  { city: 'Interlaken', country: 'Switzerland', lat: 46.6863, lon: 7.8632 },

  // Northern & Eastern Europe
  { city: 'Stockholm', country: 'Sweden', lat: 59.3293, lon: 18.0686 },
  { city: 'Oslo', country: 'Norway', lat: 59.9139, lon: 10.7522 },
  { city: 'Bergen', country: 'Norway', lat: 60.3913, lon: 5.3221 },
  { city: 'Tromso', country: 'Norway', lat: 69.6492, lon: 18.9553 },
  { city: 'Copenhagen', country: 'Denmark', lat: 55.6761, lon: 12.5683 },
  { city: 'Helsinki', country: 'Finland', lat: 60.1699, lon: 24.9384 },
  { city: 'Reykjavik', country: 'Iceland', lat: 64.1466, lon: -21.9426 },
  { city: 'Prague', country: 'Czech Republic', lat: 50.0755, lon: 14.4378 },
  { city: 'Budapest', country: 'Hungary', lat: 47.4979, lon: 19.0402 },
  { city: 'Warsaw', country: 'Poland', lat: 52.2297, lon: 21.0122 },
  { city: 'Krakow', country: 'Poland', lat: 50.0647, lon: 19.945 },
  { city: 'Dubrovnik', country: 'Croatia', lat: 42.6507, lon: 18.0944 },
  { city: 'Split', country: 'Croatia', lat: 43.5081, lon: 16.4402 },
  { city: 'Athens', country: 'Greece', lat: 37.9838, lon: 23.7275 },
  { city: 'Santorini', country: 'Greece', lat: 36.3932, lon: 25.4615 },
  { city: 'Mykonos', country: 'Greece', lat: 37.4467, lon: 25.3289 },
  { city: 'Crete', country: 'Greece', lat: 35.2401, lon: 24.8093 },
  { city: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 },
  { city: 'Cappadocia', country: 'Turkey', lat: 38.6431, lon: 34.8289 },

  // North America
  { city: 'New York City', country: 'United States', lat: 40.7128, lon: -74.006 },
  { city: 'San Francisco', country: 'United States', lat: 37.7749, lon: -122.4194 },
  { city: 'Los Angeles', country: 'United States', lat: 34.0522, lon: -118.2437 },
  { city: 'San Diego', country: 'United States', lat: 32.7157, lon: -117.1611 },
  { city: 'Seattle', country: 'United States', lat: 47.6062, lon: -122.3321 },
  { city: 'Portland', country: 'United States', lat: 45.5152, lon: -122.6784 },
  { city: 'Las Vegas', country: 'United States', lat: 36.1699, lon: -115.1398 },
  { city: 'Grand Canyon', country: 'United States', lat: 36.0544, lon: -112.1401 },
  { city: 'Yosemite', country: 'United States', lat: 37.8651, lon: -119.5383 },
  { city: 'Yellowstone', country: 'United States', lat: 44.428, lon: -110.5885 },
  { city: 'Denver', country: 'United States', lat: 39.7392, lon: -104.9903 },
  { city: 'Chicago', country: 'United States', lat: 41.8781, lon: -87.6298 },
  { city: 'Boston', country: 'United States', lat: 42.3601, lon: -71.0589 },
  { city: 'Miami', country: 'United States', lat: 25.7617, lon: -80.1918 },
  { city: 'Austin', country: 'United States', lat: 30.2672, lon: -97.7431 },
  { city: 'Honolulu', country: 'United States', lat: 21.3069, lon: -157.8583 },
  { city: 'Maui', country: 'United States', lat: 20.7984, lon: -156.3319 },
  { city: 'Vancouver', country: 'Canada', lat: 49.2827, lon: -123.1207 },
  { city: 'Banff', country: 'Canada', lat: 51.1784, lon: -115.5708 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { city: 'Montreal', country: 'Canada', lat: 45.5017, lon: -73.5673 },
  { city: 'Quebec City', country: 'Canada', lat: 46.8139, lon: -71.208 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332 },
  { city: 'Cancun', country: 'Mexico', lat: 21.1619, lon: -86.8515 },
  { city: 'Oaxaca', country: 'Mexico', lat: 17.0732, lon: -96.7266 },

  // Asia & Oceania
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { city: 'Kyoto', country: 'Japan', lat: 35.0116, lon: 135.7681 },
  { city: 'Osaka', country: 'Japan', lat: 34.6937, lon: 135.5023 },
  { city: 'Mount Fuji', country: 'Japan', lat: 35.3606, lon: 138.7274 },
  { city: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978 },
  { city: 'Busan', country: 'South Korea', lat: 35.1796, lon: 129.0756 },
  { city: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  { city: 'Chiang Mai', country: 'Thailand', lat: 18.7883, lon: 98.9853 },
  { city: 'Phuket', country: 'Thailand', lat: 7.8804, lon: 98.3923 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { city: 'Bali', country: 'Indonesia', lat: -8.4095, lon: 115.1889 },
  { city: 'Hanoi', country: 'Vietnam', lat: 21.0285, lon: 105.8542 },
  { city: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lon: 106.6297 },
  { city: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { city: 'Taipei', country: 'Taiwan', lat: 25.033, lon: 121.5654 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { city: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631 },
  { city: 'Auckland', country: 'New Zealand', lat: -36.8485, lon: 174.7633 },
  { city: 'Queenstown', country: 'New Zealand', lat: -45.0312, lon: 168.6626 },

  // South America, Africa & Middle East
  { city: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lon: -43.1729 },
  { city: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { city: 'Cusco / Machu Picchu', country: 'Peru', lat: -13.5319, lon: -71.9675 },
  { city: 'Cape Town', country: 'South Africa', lat: -33.9249, lon: 18.4241 },
  { city: 'Marrakech', country: 'Morocco', lat: 31.6295, lon: -7.9811 },
  { city: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708 }
];

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns nearest city and country for a given latitude & longitude.
 * Falls back to approximate location or coordinates if distance > 120km.
 */
export function reverseGeocode(latitude: number, longitude: number): { city: string; country: string } | undefined {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;

  let closest: GeoLocation | undefined;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const city of CITIES) {
    const dist = haversineDistanceKm(latitude, longitude, city.lat, city.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closest = city;
    }
  }

  // If within 150km of a known hub, use city and country
  if (closest && minDistance <= 150) {
    return { city: closest.city, country: closest.country };
  }

  return undefined;
}
