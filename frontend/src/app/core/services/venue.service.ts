import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface Venue {
  id: string;
  name: string;
  city?: string;
  state?: string;
  address_line1?: string;
  latitude?: string | number;
  longitude?: string | number;
  distance?: number;
  games_available?: string[];
  description?: string;
}

export interface VenueListOptions {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

@Injectable({ providedIn: 'root' })
export class VenueService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  async list(options?: VenueListOptions): Promise<Venue[]> {
    const params: Record<string, string> = {};
    if (options?.lat != null) params['lat'] = String(options.lat);
    if (options?.lng != null) params['lng'] = String(options.lng);
    if (options?.radiusKm != null) params['radiusKm'] = String(options.radiusKm);

    const httpParams = new HttpParams({ fromObject: params });

    return this.http
      .get<{ success: boolean; data: Venue[] }>(`${this.api}/venues`, { params: httpParams })
      .toPromise()
      .then((r: any) => r?.data ?? []);
  }
}
