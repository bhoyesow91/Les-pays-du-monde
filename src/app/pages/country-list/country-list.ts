import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { RouterLink } from '@angular/router';
import { CountryService } from '../../services/country-service';
import { CountrySummary, capitalOf } from '../../models/country.model';

@Component({
  selector: 'app-country-list',
  imports: [RouterLink, DecimalPipe],
  template: `
    <section class="filters">
      <input type="search" placeholder="Rechercher un pays ou une capitale…"
             [value]="search()" (input)="search.set($any($event.target).value)" />
      <select [value]="region()" (change)="region.set($any($event.target).value)">
        <option value="">Toutes les régions</option>
        @for (r of regions(); track r) { <option [value]="r">{{ r }}</option> }
      </select>
      <select [value]="sort()" (change)="sort.set($any($event.target).value)">
        <option value="name">Trier par nom</option>
        <option value="population">Trier par population</option>
        <option value="area">Trier par superficie</option>
      </select>
    </section>

    @if (error()) {
      <p class="state error">{{ error() }}</p>
    } @else if (!countries()) {
      <p class="state">Chargement des pays…</p>
    } @else {
      <p class="count">{{ filtered().length }} pays</p>
      <div class="grid">
        @for (c of filtered(); track c.codes.alpha_3) {
          <a class="card" [routerLink]="['/pays', c.codes.alpha_3]">
            <img [src]="c.flag.url_svg" [alt]="c.flag.description || 'Drapeau de ' + c.names.common" loading="lazy" />
            <div class="card-body">
              <h2>{{ c.names.common }}</h2>
              <p>{{ capital(c) }}</p>
              <p class="muted">{{ c.population | number }} hab.</p>
            </div>
          </a>
        } @empty {
          <p class="state">Aucun pays ne correspond à votre recherche.</p>
        }
      </div>
    }
  `,
})
export class CountryList {
  private service = inject(CountryService);
  capital = capitalOf;
  error = signal('');

  countries = toSignal(
    this.service.getAll().pipe(
      catchError((e: HttpErrorResponse) => {
        this.error.set(this.messageFor(e));
        return of(undefined);
      })
    )
  );

  search = signal('');
  region = signal('');
  sort = signal<'name' | 'population' | 'area'>('name');

  regions = computed(() =>
    [...new Set((this.countries() ?? []).map((c) => c.region))].filter(Boolean).sort()
  );

  filtered = computed<CountrySummary[]>(() => {
    const q = this.search().trim().toLowerCase();
    const r = this.region();
    const list = (this.countries() ?? []).filter(
      (c) =>
        (!r || c.region === r) &&
        (!q ||
          c.names.common.toLowerCase().includes(q) ||
          (c.capitals ?? []).some((x) => x.name.toLowerCase().includes(q)))
    );
    const s = this.sort();
    return [...list].sort((a, b) =>
      s === 'name'
        ? a.names.common.localeCompare(b.names.common)
        : s === 'population'
          ? (b.population ?? 0) - (a.population ?? 0)
          : (b.area?.kilometers ?? 0) - (a.area?.kilometers ?? 0)
    );
  });

  private messageFor(e: HttpErrorResponse): string {
    if (e.status === 0)
      return "Requête bloquée. Vérifie ta connexion et que « localhost » est bien dans les origines autorisées de ta clé API.";
    if (e.status === 401) return "Clé API manquante ou invalide : vérifie src/app/api-config.ts.";
    if (e.status === 403) return "Accès refusé par l'API (quota mensuel dépassé ou compte gelé).";
    return `Erreur de l'API (code ${e.status}).`;
  }
}