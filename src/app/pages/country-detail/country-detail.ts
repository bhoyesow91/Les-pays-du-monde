import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Country, CountrySummary, capitalOf } from '../../models/country.model';
import { CountryService } from '../../services/country-service';

@Component({
  selector: 'app-country-detail',
  imports: [RouterLink, DecimalPipe],
  template: `
    <a routerLink="/" class="back">‹ Retour à la liste</a>

    @if (error()) {
      <p class="state error">Pays introuvable ou API indisponible.</p>
    } @else if (!country()) {
      <p class="state">Chargement…</p>
    } @else {
      @let c = country()!;
      <article class="detail">
        <header class="detail-head">
          <img class="flag" [src]="c.flag.url_svg" [alt]="c.flag.description || 'Drapeau de ' + c.names.common" />
          <div>
            <h1>{{ c.names.common }}</h1>
            <p class="muted">{{ c.names.official }}</p>
          </div>
        </header>

        <dl class="facts">
          <div><dt>Capitale</dt><dd>{{ capital(c) }}</dd></div>
          <div><dt>Population</dt><dd>{{ c.population | number }} habitants</dd></div>
          <div><dt>Superficie</dt><dd>{{ c.area.kilometers | number }} km²</dd></div>
          <div><dt>Densité</dt><dd>{{ c.area.kilometers ? (c.population / c.area.kilometers | number: '1.0-1') : '—' }} hab./km²</dd></div>
          <div><dt>Région</dt><dd>{{ c.region }}{{ c.subregion ? ' – ' + c.subregion : '' }}</dd></div>
          <div><dt>Langues</dt><dd>{{ languages(c) }}</dd></div>
          <div><dt>Monnaies</dt><dd>{{ currencies(c) }}</dd></div>
          <div><dt>Fuseaux horaires</dt><dd>{{ c.timezones.join(', ') }}</dd></div>
        </dl>

        <section>
          <h2>Hymne national</h2>
          <p class="muted">L'API REST Countries ne fournit pas les hymnes : le lien ci-dessous ouvre la recherche YouTube correspondante.</p>
          <a class="btn" target="_blank" rel="noopener" [href]="anthemUrl(c)">Écouter l'hymne de {{ c.names.common }}</a>
        </section>

        <section>
          <h2>Localisation</h2>
          <iframe class="map" [src]="mapUrl(c)" [title]="'Carte de ' + c.names.common" loading="lazy"></iframe>
          @if (c.links?.google_maps) {
            <p><a target="_blank" rel="noopener" [href]="c.links!.google_maps">Ouvrir dans Google Maps</a></p>
          }
        </section>

        @if (borders().length) {
          <section>
            <h2>Pays frontaliers</h2>
            <div class="chips">
              @for (b of borders(); track b.codes.alpha_3) {
                <a class="chip" [routerLink]="['/pays', b.codes.alpha_3]">
                  <img [src]="b.flag.url_svg" alt="" /> {{ b.names.common }}
                </a>
              }
            </div>
          </section>
        }
      </article>
    }
  `,
})
export class CountryDetail {
  private route = inject(ActivatedRoute);
  private service = inject(CountryService);
  private sanitizer = inject(DomSanitizer);

  capital = capitalOf;
  country = signal<Country | null>(null);
  borders = signal<CountrySummary[]>([]);
  error = signal(false);

  constructor() {
    this.route.paramMap
      .pipe(
        tap(() => {
          this.country.set(null);
          this.borders.set([]);
          this.error.set(false);
          window.scrollTo(0, 0);
        }),
        switchMap((p) => this.service.getByCode(p.get('code')!)),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (c) => {
          this.country.set(c);
          if (c.borders?.length) {
            // Les pays frontaliers sont retrouvés dans la liste déjà en mémoire
            this.service.getAll().subscribe((all) =>
              this.borders.set(all.filter((x) => c.borders!.includes(x.codes.alpha_3)))
            );
          }
        },
        error: () => this.error.set(true),
      });
  }

  /** Lit un libellé dans une valeur dont la forme exacte peut varier */
  private label(x: unknown): string {
    if (typeof x === 'string') return x;
    if (x && typeof x === 'object') {
      const o = x as Record<string, any>;
      const v =
        o['name'] ?? o['english_name'] ?? o['english'] ?? o['names']?.['english'] ??
        Object.values(o).find((val) => typeof val === 'string');
      return typeof v === 'string' ? v : '';
    }
    return '';
  }

  languages(c: Country): string {
    const l = c.languages;
    if (!l) return '—';
    const items = Array.isArray(l) ? l : Object.values(l as object);
    return items.map((i) => this.label(i)).filter(Boolean).join(', ') || '—';
  }

  currencies(c: Country): string {
    const cur = c.currencies;
    if (!cur) return '—';
    const entries: [string, any][] = Array.isArray(cur)
      ? cur.map((v, i) => [String(v?.code ?? i), v])
      : Object.entries(cur as object);
    const text = entries
      .map(([k, v]) => {
        const symbol = v && typeof v === 'object' && v.symbol ? ` (${v.symbol})` : '';
        return (this.label(v) || k) + symbol;
      })
      .join(', ');
    return text || '—';
  }

  anthemUrl(c: Country) {
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`hymne national ${c.names.common}`);
  }

  /** Carte Google Maps intégrée, zoom adapté à la superficie du pays */
  mapUrl(c: Country): SafeResourceUrl {
    const a = c.area.kilometers;
    const zoom = a > 5e6 ? 3 : a > 1e6 ? 4 : a > 2e5 ? 5 : a > 3e4 ? 6 : a > 2e3 ? 8 : 10;
    const url = `https://maps.google.com/maps?q=${c.coordinates.lat},${c.coordinates.lng}&z=${zoom}&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}