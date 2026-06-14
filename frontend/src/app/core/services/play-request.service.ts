import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PlayRequest {
  profile_id?: string;
  sport_name: string;
  requested_date: string;
  requested_time: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_km: number;
}

export interface PlayRequestResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

@Injectable({ providedIn: 'root' })
export class PlayRequestService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  create(request: PlayRequest): Observable<PlayRequestResponse> {
    return this.http.post<PlayRequestResponse>(
      `${this.apiUrl}/play-requests`,
      request
    );
  }
}
