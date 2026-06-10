// packages/shared/constants/wilayas.ts
// Complete list of Algeria's 58 wilayas (provinces)
// Ordered by wilaya number (official administrative code)

export const WILAYAS: readonly string[] = [
  'Adrar',
  'Chlef',
  'Laghouat',
  'Oum El Bouaghi',
  'Batna',
  'Béjaïa',
  'Biskra',
  'Béchar',
  'Blida',
  'Bouira',
  'Tamanrasset',
  'Tébessa',
  'Tlemcen',
  'Tiaret',
  'Tizi Ouzou',
  'Alger',
  'Djelfa',
  'Jijel',
  'Sétif',
  'Saïda',
  'Skikda',
  'Sidi Bel Abbès',
  'Annaba',
  'Guelma',
  'Constantine',
  'Médéa',
  'Mostaganem',
  "M'Sila",
  'Mascara',
  'Ouargla',
  'Oran',
  'El Bayadh',
  'Illizi',
  'Bordj Bou Arréridj',
  'Boumerdès',
  'El Tarf',
  'Tindouf',
  'Tissemsilt',
  'El Oued',
  'Khenchela',
  'Souk Ahras',
  'Tipaza',
  'Mila',
  'Aïn Defla',
  'Naâma',
  'Aïn Témouchent',
  'Ghardaïa',
  'Relizane',
  'Timimoun',
  'Bordj Badji Mokhtar',
  'Ouled Djellal',
  'Béni Abbès',
  'In Salah',
  'In Guezzam',
  'Touggourt',
  'Djanet',
  "El M'Ghair",
  'El Meniaa',
] as const;

// For dropdown/filter components — prepend "Toutes" option
export const WILAYAS_WITH_ALL = ['Toutes', ...WILAYAS] as const;

// ─── Wilaya bounding boxes (lat_min, lat_max, lng_min, lng_max) ───────────────
// Ordered by population density so the most-likely match is tested first.
// Coordinates are approximate administrative boundaries.
export const WILAYA_BOUNDS: Array<{ name: string; latMin: number; latMax: number; lngMin: number; lngMax: number }> = [
  { name: 'Alger',           latMin: 36.60, latMax: 36.92, lngMin: 2.85,  lngMax: 3.35  },
  { name: 'Oran',            latMin: 35.40, latMax: 35.85, lngMin: -0.75, lngMax: -0.40 },
  { name: 'Constantine',     latMin: 36.25, latMax: 36.50, lngMin: 6.50,  lngMax: 6.75  },
  { name: 'Annaba',          latMin: 36.65, latMax: 36.95, lngMin: 7.65,  lngMax: 7.85  },
  { name: 'Blida',           latMin: 36.35, latMax: 36.65, lngMin: 2.60,  lngMax: 3.05  },
  { name: 'Sétif',           latMin: 35.90, latMax: 36.30, lngMin: 5.20,  lngMax: 5.60  },
  { name: 'Tizi Ouzou',      latMin: 36.55, latMax: 36.95, lngMin: 3.80,  lngMax: 4.35  },
  { name: 'Béjaïa',          latMin: 36.55, latMax: 36.90, lngMin: 4.85,  lngMax: 5.25  },
  { name: 'Batna',           latMin: 35.35, latMax: 35.75, lngMin: 5.85,  lngMax: 6.35  },
  { name: 'Boumerdès',       latMin: 36.65, latMax: 36.92, lngMin: 3.35,  lngMax: 3.85  },
  { name: 'Tipaza',          latMin: 36.45, latMax: 36.75, lngMin: 2.15,  lngMax: 2.85  },
  { name: 'Médéa',           latMin: 35.85, latMax: 36.40, lngMin: 2.55,  lngMax: 3.10  },
  { name: 'Tlemcen',         latMin: 34.55, latMax: 35.15, lngMin: -1.55, lngMax: -1.10 },
  { name: 'Skikda',          latMin: 36.70, latMax: 37.00, lngMin: 6.70,  lngMax: 7.00  },
  { name: 'Guelma',          latMin: 36.25, latMax: 36.60, lngMin: 7.25,  lngMax: 7.65  },
  { name: 'Jijel',           latMin: 36.65, latMax: 37.00, lngMin: 5.40,  lngMax: 5.95  },
  { name: 'Mostaganem',      latMin: 35.70, latMax: 36.10, lngMin: 0.05,  lngMax: 0.45  },
  { name: 'Sidi Bel Abbès',  latMin: 34.95, latMax: 35.30, lngMin: -0.75, lngMax: -0.35 },
  { name: 'Mascara',         latMin: 35.15, latMax: 35.60, lngMin: 0.00,  lngMax: 0.50  },
  { name: 'Tiaret',          latMin: 35.10, latMax: 35.55, lngMin: 1.20,  lngMax: 1.75  },
  { name: 'Chlef',           latMin: 36.00, latMax: 36.40, lngMin: 0.95,  lngMax: 1.50  },
  { name: 'Aïn Defla',       latMin: 36.10, latMax: 36.55, lngMin: 1.60,  lngMax: 2.20  },
  { name: 'Relizane',        latMin: 35.60, latMax: 35.95, lngMin: 0.45,  lngMax: 1.05  },
  { name: 'Mila',            latMin: 36.20, latMax: 36.55, lngMin: 6.15,  lngMax: 6.60  },
  { name: 'Oum El Bouaghi',  latMin: 35.75, latMax: 36.15, lngMin: 6.75,  lngMax: 7.25  },
  { name: 'Khenchela',       latMin: 35.25, latMax: 35.65, lngMin: 6.90,  lngMax: 7.30  },
  { name: 'Tébessa',         latMin: 35.00, latMax: 35.55, lngMin: 7.80,  lngMax: 8.30  },
  { name: 'Souk Ahras',      latMin: 36.10, latMax: 36.55, lngMin: 7.70,  lngMax: 8.15  },
  { name: 'El Tarf',         latMin: 36.55, latMax: 36.90, lngMin: 7.90,  lngMax: 8.45  },
  { name: 'Bordj Bou Arréridj', latMin: 35.90, latMax: 36.25, lngMin: 4.60, lngMax: 5.20 },
  { name: 'Bouira',          latMin: 36.20, latMax: 36.65, lngMin: 3.75,  lngMax: 4.40  },
  { name: 'Aïn Témouchent',  latMin: 35.20, latMax: 35.55, lngMin: -1.30, lngMax: -0.80 },
  { name: 'Naâma',           latMin: 33.10, latMax: 33.70, lngMin: -0.65, lngMax: -0.05 },
  { name: 'El Bayadh',       latMin: 33.25, latMax: 33.85, lngMin: 0.55,  lngMax: 1.30  },
  { name: 'Tissemsilt',      latMin: 35.55, latMax: 35.95, lngMin: 1.60,  lngMax: 2.05  },
  { name: 'Saïda',           latMin: 34.55, latMax: 34.90, lngMin: 0.05,  lngMax: 0.60  },
  { name: 'Laghouat',        latMin: 33.45, latMax: 33.90, lngMin: 2.60,  lngMax: 3.10  },
  { name: 'Djelfa',          latMin: 34.25, latMax: 34.80, lngMin: 3.10,  lngMax: 3.75  },
  { name: 'Ghardaïa',        latMin: 32.15, latMax: 32.60, lngMin: 3.50,  lngMax: 4.00  },
  { name: 'Ouargla',         latMin: 31.75, latMax: 32.20, lngMin: 4.75,  lngMax: 5.25  },
  { name: 'Biskra',          latMin: 34.40, latMax: 34.90, lngMin: 5.45,  lngMax: 5.95  },
  { name: "M'Sila",          latMin: 35.40, latMax: 35.85, lngMin: 4.35,  lngMax: 4.85  },
  { name: 'El Oued',         latMin: 33.15, latMax: 33.65, lngMin: 6.55,  lngMax: 7.05  },
  { name: 'Adrar',           latMin: 27.50, latMax: 28.10, lngMin: -0.35, lngMax: 0.35  },
  { name: 'Tamanrasset',     latMin: 22.50, latMax: 23.00, lngMin: 5.25,  lngMax: 5.75  },
  { name: 'Illizi',          latMin: 26.20, latMax: 26.70, lngMin: 8.30,  lngMax: 8.80  },
  { name: 'Tindouf',         latMin: 27.50, latMax: 28.00, lngMin: -8.20, lngMax: -7.70 },
  { name: 'Béchar',          latMin: 31.40, latMax: 31.85, lngMin: -2.30, lngMax: -1.80 },
  { name: 'Timimoun',        latMin: 29.15, latMax: 29.60, lngMin: 0.15,  lngMax: 0.55  },
  { name: 'Touggourt',       latMin: 32.95, latMax: 33.35, lngMin: 5.80,  lngMax: 6.20  },
  { name: 'Djanet',          latMin: 24.40, latMax: 24.90, lngMin: 9.30,  lngMax: 9.70  },
  { name: 'In Salah',        latMin: 27.00, latMax: 27.40, lngMin: 2.35,  lngMax: 2.75  },
  { name: 'In Guezzam',      latMin: 19.40, latMax: 19.80, lngMin: 5.60,  lngMax: 6.00  },
  { name: 'Bordj Badji Mokhtar', latMin: 21.20, latMax: 21.60, lngMin: 0.70, lngMax: 1.10 },
  { name: 'Ouled Djellal',   latMin: 34.35, latMax: 34.70, lngMin: 4.80,  lngMax: 5.20  },
  { name: 'Béni Abbès',      latMin: 30.00, latMax: 30.40, lngMin: -2.20, lngMax: -1.80 },
  { name: "El M'Ghair",      latMin: 33.60, latMax: 33.95, lngMin: 5.65,  lngMax: 6.05  },
  { name: 'El Meniaa',       latMin: 30.50, latMax: 30.90, lngMin: 2.45,  lngMax: 2.85  },
];

/**
 * Determine a user's wilaya from GPS coordinates using bounding-box lookup.
 * Returns the matched wilaya name, or null if coordinates are outside all boxes
 * (e.g. remote desert, offshore, or outside Algeria).
 */
export function getWilayaFromCoords(lat: number, lng: number): string | null {
  for (const w of WILAYA_BOUNDS) {
    if (lat >= w.latMin && lat <= w.latMax && lng >= w.lngMin && lng <= w.lngMax) {
      return w.name;
    }
  }
  return null;
}
