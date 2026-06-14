import { HttpClient } from '@angular/common/http';
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

@Injectable({ providedIn: 'root' })
export class VenueService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  async list(): Promise<Venue[]> {
    return this.http
      .get<{ success: boolean; data: Venue[] }>(`${this.api}/venues`)
      .toPromise()
      .then((r: any) => r?.data ?? []);
  }
}
