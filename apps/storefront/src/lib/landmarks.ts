// Kwara landmarks shown on the store map (owner request, 21 Nov 2026).
// Coordinates come from OpenStreetMap (Nominatim lookups on 21 Nov 2026,
// only exact named matches kept). Places that could not be matched reliably
// (Ilorin Central Mosque, Palms Mall, Owu Falls, Federal Polytechnic Offa,
// Patigi) are left out rather than guessed. Landmarks are reference points
// only — stores stay Ilorin-only.

export type LandmarkKind = 'university' | 'polytechnic' | 'palace' | 'mall' | 'market' | 'airport' | 'hospital' | 'stadium' | 'hill' | 'town' | 'museum';

export interface Landmark {
  id: string;
  name: string;
  short?: string;
  kind: LandmarkKind;
  lat: number;
  lng: number;
  /** City/town it belongs to, for the label and search. */
  place: string;
}

export const LANDMARKS: readonly Landmark[] = [
  // ---- Ilorin
  { id: 'unilorin', name: 'University of Ilorin', short: 'Unilorin', kind: 'university', lat: 8.47677, lng: 4.65851, place: 'Ilorin' },
  { id: 'alhikmah', name: 'Al-Hikmah University', short: 'Al-Hikmah', kind: 'university', lat: 8.48139, lng: 4.50383, place: 'Ilorin' },
  { id: 'kwarapoly', name: 'Kwara State Polytechnic', short: 'Kwara Poly', kind: 'polytechnic', lat: 8.54334, lng: 4.63426, place: 'Ilorin' },
  { id: 'emirs-palace', name: "Emir's Palace", kind: 'palace', lat: 8.49628, lng: 4.54643, place: 'Ilorin' },
  { id: 'airport', name: 'Ilorin International Airport', short: 'Airport', kind: 'airport', lat: 8.43922, lng: 4.49462, place: 'Ilorin' },
  { id: 'kwara-mall', name: 'Kwara Mall (Shoprite)', short: 'Kwara Mall', kind: 'mall', lat: 8.49908, lng: 4.58612, place: 'Ilorin' },
  { id: 'emirate-mall', name: 'Ilorin Emirate Mall', short: 'Emirate Mall', kind: 'mall', lat: 8.44783, lng: 4.50856, place: 'Ilorin' },
  { id: 'uith', name: 'University of Ilorin Teaching Hospital', short: 'UITH', kind: 'hospital', lat: 8.47965, lng: 4.53202, place: 'Ilorin' },
  { id: 'stadium', name: 'Kwara State Stadium', short: 'Stadium', kind: 'stadium', lat: 8.47555, lng: 4.54212, place: 'Ilorin' },
  { id: 'ipata-market', name: 'Ipata Market', kind: 'market', lat: 8.4993, lng: 4.56161, place: 'Ilorin' },
  { id: 'mandate-market', name: 'Mandate Market', kind: 'market', lat: 8.47523, lng: 4.50578, place: 'Ilorin' },
  { id: 'sobi-rock', name: 'Sobi Rock', kind: 'hill', lat: 8.55, lng: 4.55, place: 'Ilorin' },
  // ---- Across Kwara
  { id: 'kwasu', name: 'Kwara State University (KWASU)', short: 'KWASU', kind: 'university', lat: 8.71963, lng: 4.4817, place: 'Malete' },
  { id: 'landmark-university', name: 'Landmark University', kind: 'university', lat: 8.12124, lng: 5.07735, place: 'Omu-Aran' },
  { id: 'offa', name: 'Offa', kind: 'town', lat: 8.156, lng: 4.72274, place: 'Offa' },
  { id: 'omu-aran', name: 'Omu-Aran', kind: 'town', lat: 8.13859, lng: 5.10133, place: 'Omu-Aran' },
  { id: 'esie', name: 'Esie (Esie Museum)', short: 'Esie', kind: 'museum', lat: 8.21461, lng: 4.89953, place: 'Esie' },
  { id: 'jebba', name: 'Jebba', kind: 'town', lat: 9.12049, lng: 4.82379, place: 'Jebba' },
  { id: 'lafiagi', name: 'Lafiagi', kind: 'town', lat: 8.85375, lng: 5.41895, place: 'Lafiagi' },
  { id: 'kaiama', name: 'Kaiama', kind: 'town', lat: 9.53602, lng: 4.11481, place: 'Kaiama' },
];

export function searchLandmarks(q: string): Landmark[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  return LANDMARKS.filter((l) =>
    [l.name, l.short ?? '', l.place].some((t) => t.toLowerCase().includes(s)),
  ).slice(0, 6);
}
