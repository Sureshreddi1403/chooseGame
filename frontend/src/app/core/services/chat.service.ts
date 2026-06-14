import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatMessagesResponse {
  success: boolean;
  data: ChatMessage[];
}

export interface SingleChatMessageResponse {
  success: boolean;
  data: ChatMessage;
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
}
