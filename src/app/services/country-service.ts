import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce, shareReplay } from 'rxjs';
import { API_BASE, API_KEY } from '../api-config';
import { Country, CountrySummary } from '../models/country.model';

interface Page<T> {
  data: {
    objects: T[];
    meta: { total: number; count: number; limit: number; offset: number; more: boolean };
  };
}

const LIST_FIELDS =
  'names.common,names.official,codes.alpha_3,flag.url_svg,flag.url_png,flag.description,population,capitals,region,area.kilometers';

@Injectable({ providedIn: 'root' })
export class CountryService {
  private http = inject(HttpClient);
  private headers = new HttpHeaders({ Authorization: `Bearer ${API_KEY}` });
  private all$?: Observable<CountrySummary[]>;

  private page(offset: number): Observable<Page<CountrySummary>> {
    return this.http.get<Page<CountrySummary>>(
      `${API_BASE}?limit=100&offset=${offset}&response_fields=${LIST_FIELDS}`,
      { headers: this.headers }
    );
  }

  /** Tous les pays (plusieurs pages), gardés en mémoire après le premier chargement */
  getAll(): Observable<CountrySummary[]> {
    if (!this.all$) {
      this.all$ = this.page(0).pipe(
        expand((r) =>
          r.data.meta.more ? this.page(r.data.meta.offset + r.data.meta.count) : EMPTY
        ),
        reduce((acc, r) => acc.concat(r.data.objects), [] as CountrySummary[]),
        shareReplay(1)
      );
    }
    return this.all$;
  }

  /** Détail d'un pays via son code à 3 lettres (ex : GIN) */
  getByCode(code: string): Observable<Country> {
    return this.http
      .get<Page<Country>>(
        `${API_BASE}/codes.alpha_3/${code}?response_fields_omit=names.translations,leaders`,
        { headers: this.headers }
      )
      .pipe(
        map((r) => {
          const c = r.data.objects[0];
          if (!c) throw new Error('Pays introuvable');
          return c;
        })
      );
  }
}