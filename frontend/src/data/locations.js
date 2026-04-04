/**
 * Sample historical locations for Los Angeles.
 *
 * In production these would come from GET /api/locations.
 * For now they are hard-coded here so the frontend works without the Flask backend running.
 *
 * Each location has:
 *   id              — unique identifier
 *   name            — display name
 *   era             — one of: native | spanish | rancho | modern
 *   latitude        — decimal degrees
 *   longitude       — decimal degrees
 *   short_description — one or two sentences shown in the InfoPanel
 *   points          — points awarded when the user marks it as visited
 */
const LOCATIONS = [
  {
    id: 1,
    name: 'Kuruvungna Springs',
    era: 'native',
    latitude: 34.0699,
    longitude: -118.4438,
    short_description:
      'A sacred freshwater spring on the UCLA campus used by the Tongva people for thousands of years. It remains an active ceremonial site today.',
    points: 10,
  },
  {
    id: 2,
    name: 'Mission San Gabriel Arcángel',
    era: 'spanish',
    latitude: 34.0961,
    longitude: -118.1058,
    short_description:
      'Founded in 1771, Mission San Gabriel was the fourth of California\'s 21 missions and became one of the most prosperous, shaping the region\'s early economy.',
    points: 10,
  },
  {
    id: 3,
    name: 'El Pueblo de Los Ángeles',
    era: 'spanish',
    latitude: 34.0578,
    longitude: -118.2382,
    short_description:
      'The original settlement founded in 1781 by 44 pobladores. The historic district preserves the oldest buildings in Los Angeles, including the 1818 Avila Adobe.',
    points: 10,
  },
  {
    id: 4,
    name: 'Rancho Los Cerritos',
    era: 'rancho',
    latitude: 33.8073,
    longitude: -118.1662,
    short_description:
      'A 27,000-acre Mexican-era rancho that operated from the 1830s. The adobe house still stands in Long Beach and offers a window into the rancho economy.',
    points: 10,
  },
  {
    id: 5,
    name: 'Union Station',
    era: 'modern',
    latitude: 34.0560,
    longitude: -118.2366,
    short_description:
      'Opened in 1939, Union Station blends Mission Revival, Streamline Moderne, and Art Deco styles. It was the last great railroad station built in the United States.',
    points: 10,
  },
]

export default LOCATIONS
