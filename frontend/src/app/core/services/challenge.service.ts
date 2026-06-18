import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChallengeRequest {
  sender_id: string;
  receiver_id: string;
  sport: string;
  message?: string;
}

export interface PlayerProfileRef {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  skill_level?: string;
  player_location_label?: string;
}

export interface Challenge {
  id: string;
  sport: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender_id?: string;
  receiver_id?: string;
  profiles?: PlayerProfileRef; // The other player's profile info
}

export interface ChallengesResponse {
  success: boolean;
  data: Challenge[];
}

export interface SingleChallengeResponse {
  success: boolean;
  data: Challenge;
}

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  createChallenge(payload: ChallengeRequest): Observable<SingleChallengeResponse> {
    return this.http.post<SingleChallengeResponse>(`${this.api}/challenges`, payload);
  }

  getReceivedChallenges(userId: string): Observable<ChallengesResponse> {
    return this.http.get<ChallengesResponse>(`${this.api}/challenges/received?userId=${userId}`);
  }

  getSentChallenges(userId: string): Observable<ChallengesResponse> {
    return this.http.get<ChallengesResponse>(`${this.api}/challenges/sent?userId=${userId}`);
  }

  updateChallengeStatus(id: string, status: 'accepted' | 'rejected', userId: string): Observable<SingleChallengeResponse> {
    return this.http.put<SingleChallengeResponse>(`${this.api}/challenges/${id}/status`, { status, userId });
  }
}
