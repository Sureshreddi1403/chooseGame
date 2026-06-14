import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Player {
  id: string;
  username: string;
  bio?: string;
  skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'pro';
  sport_preferences?: string[];
  rating?: number;
  player_lat: number;
  player_lng: number;
  player_location_label?: string;
  distanceKm?: number;
}

export interface PlayerProfile extends Player {
  first_name?: string;
  last_name?: string;
  gender?: string;
  handedness?: string;
  is_discoverable?: boolean;
  created_at?: string;
}

export interface ProfileUpdatePayload {
  userId: string;
  bio?: string;
  skill_level?: string;
  sport_preferences?: string[];
  player_lat?: number | null;
  player_lng?: number | null;
  player_location_label?: string;
  is_discoverable?: boolean;
}

export interface PlayersResponse {
  success: boolean;
  data: Player[];
}

export interface ProfileResponse {
  success: boolean;
  data: PlayerProfile;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getPlayers(sport?: string, lat?: number, lng?: number): Observable<PlayersResponse> {
    let params = new HttpParams();
    if (sport && sport !== 'all') params = params.set('sport', sport);
    if (lat != null) params = params.set('lat', String(lat));
    if (lng != null) params = params.set('lng', String(lng));
    return this.http.get<PlayersResponse>(`${this.api}/players`, { params });
  }

  getProfile(userId: string): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>(`${this.api}/profile/${userId}`);
  }

  updateProfile(payload: ProfileUpdatePayload): Observable<ProfileResponse> {
    return this.http.put<ProfileResponse>(`${this.api}/profile`, payload);
  }
}
