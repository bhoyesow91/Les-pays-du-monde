export interface Capital {
  name: string;
  attributes?: { primary?: boolean };
}

export interface CountrySummary {
  names: { common: string; official: string };
  codes: { alpha_3: string };
  flag: { url_svg: string; url_png: string; description?: string };
  population: number;
  capitals?: Capital[];
  region: string;
  area: { kilometers: number };
}

export interface Country extends CountrySummary {
  subregion?: string;
  continents: string[];
  coordinates: { lat: number; lng: number };
  landlocked?: boolean;
  borders?: string[];
  timezones: string[];
  languages?: unknown;
  currencies?: unknown;
  links?: { google_maps?: string; open_street_maps?: string; wikipedia?: string };
}

/** Nom de la capitale principale (ou "—" s'il n'y en a pas) */
export function capitalOf(c: CountrySummary): string {
  const caps = c.capitals ?? [];
  const main = caps.find((x) => x.attributes?.primary) ?? caps[0];
  return main?.name ?? '—';
}