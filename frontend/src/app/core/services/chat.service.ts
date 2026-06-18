import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: string;
  sender_id: string | null;   // null for system messages
  content: string;
  created_at: string;
  is_system?: boolean;
  event_type?: string;        // e.g. "challenge_accepted" | "challenge_rejected"
}

export interface ChatMessagesResponse {
  success: boolean;
  data: ChatMessage[];
}

export interface SingleChatMessageResponse {
  success: boolean;
  data: ChatMessage;
}

export interface ReadReceipt {
  user_id: string;
  last_read_at: string;
}

export interface ReadStatusResponse {
  success: boolean;
  data: ReadReceipt[];
}

export interface PresenceResponse {
  success: boolean;
  data: { last_seen_at: string | null };
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getMessages(challengeId: string, userId: string): Observable<ChatMessagesResponse> {
    return this.http.get<ChatMessagesResponse>(`${this.api}/chat/${challengeId}?userId=${userId}`);
  }

  sendMessage(challengeId: string, senderId: string, content: string): Observable<SingleChatMessageResponse> {
    return this.http.post<SingleChatMessageResponse>(`${this.api}/chat/${challengeId}`, {
      sender_id: senderId,
      content,
    });
  }

  /** Mark all messages as read up to "now" */
  markAsRead(challengeId: string, userId: string): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.api}/chat/${challengeId}/read`, { userId });
  }

  /** Get both users' read watermarks for a challenge */
  getReadStatus(challengeId: string, userId: string): Observable<ReadStatusResponse> {
    return this.http.get<ReadStatusResponse>(`${this.api}/chat/${challengeId}/read-status?userId=${userId}`);
  }

  /** Send a presence heartbeat */
  sendPresenceHeartbeat(userId: string): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.api}/chat/presence`, { userId });
  }

  /** Get a user's last-seen timestamp */
  getPresence(userId: string): Observable<PresenceResponse> {
    return this.http.get<PresenceResponse>(`${this.api}/chat/presence/${userId}`);
  }
}
