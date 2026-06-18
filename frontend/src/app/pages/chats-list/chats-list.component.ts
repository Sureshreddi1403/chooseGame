import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChallengeService, Challenge } from '../../core/services/challenge.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-chats-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chats-page">
      <header class="chats-header">
        <button class="back-btn" (click)="goBack()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5m7-7-7 7 7 7"/>
          </svg>
        </button>
        <div class="header-title-group">
          <h1>Messages</h1>
          <span class="chat-count" *ngIf="activeChats().length">{{ activeChats().length }}</span>
        </div>
      </header>

      <div class="chats-body">
        <div class="loading-state" *ngIf="loading()">
          <div class="dots"><span></span><span></span><span></span></div>
        </div>

        <div class="error-msg" *ngIf="error()">{{ error() }}</div>

        <div class="empty-state" *ngIf="!loading() && activeChats().length === 0 && !error()">
          <div class="empty-icon">💬</div>
          <h3>No active chats yet</h3>
          <p>Accept a challenge to start chatting with a player.</p>
          <button class="go-home-btn" (click)="goBack()">Find Players</button>
        </div>

        <div class="chat-list" *ngIf="!loading()">
          <div class="chat-item" *ngFor="let chat of activeChats()" (click)="openChat(chat)">
            <div class="chat-avatar">
              <span>{{ getInitials(chat) }}</span>
            </div>
            <div class="chat-info">
              <div class="chat-name">{{ chat.profiles?.username || 'Player' }}</div>
              <div class="chat-meta">
                <span class="sport-chip">{{ getSportEmoji(chat.sport) }} {{ chat.sport | titlecase }}</span>
                <span class="chat-date">{{ formatDate(chat.created_at) }}</span>
              </div>
            </div>
            <div class="chat-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      inset: 0;
      z-index: 9000;
      padding: 24px;
      background: rgba(10, 11, 16, 0.75);
      backdrop-filter: blur(10px) saturate(160%);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .chats-page {
      width: 100%;
      max-width: 420px;
      max-height: min(600px, calc(100dvh - 48px));
      display: flex;
      flex-direction: column;
      background: #0f1117;
      border-radius: 24px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 40px 120px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06);
      overflow: hidden;
      animation: window-in 0.28s cubic-bezier(0.25, 0.8, 0.25, 1) both;
    }

    @keyframes window-in {
      from { opacity: 0; transform: scale(0.94) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .chats-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 16px 14px;
      background: rgba(26,29,39,0.9);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    }

    .back-btn {
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      border: none; border-radius: 10px;
      background: rgba(255,255,255,0.06);
      color: #7c86a2;
      cursor: pointer;
      transition: all 0.18s ease;
      &:hover { background: rgba(255,255,255,0.12); color: #e8eaf6; }
    }

    .header-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      h1 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #e8eaf6; }
    }

    .chat-count {
      background: #5b6ef5;
      color: #fff;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 20px;
    }

    .chats-body {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;

      &::-webkit-scrollbar { width: 3px; }
      &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
    }

    .loading-state {
      display: flex; justify-content: center;
      padding: 48px 0;
      .dots {
        display: flex; gap: 5px;
        span {
          width: 8px; height: 8px; border-radius: 50%;
          background: #5b6ef5;
          animation: bd 1.1s ease-in-out infinite;
          &:nth-child(2) { animation-delay: 0.18s; }
          &:nth-child(3) { animation-delay: 0.36s; }
        }
      }
    }

    @keyframes bd {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
      30% { transform: translateY(-8px); opacity: 1; }
    }

    .error-msg {
      color: #fca5a5;
      padding: 16px;
      text-align: center;
      font-size: 0.88rem;
    }

    .empty-state {
      padding: 48px 24px;
      text-align: center;
      color: #7c86a2;
      .empty-icon { font-size: 2.8rem; margin-bottom: 14px; }
      h3 { color: #e8eaf6; margin: 0 0 8px; font-size: 1rem; }
      p { margin: 0 0 20px; font-size: 0.85rem; line-height: 1.5; }
    }

    .go-home-btn {
      padding: 10px 22px;
      background: linear-gradient(135deg, #5b6ef5, #7c3aed);
      color: #fff;
      border: none;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      transition: all 0.18s ease;
      &:hover { transform: scale(1.04); box-shadow: 0 4px 16px rgba(91,110,245,0.4); }
    }

    .chat-list { padding: 4px 0; }

    .chat-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.15s ease;
      &:hover { background: rgba(255,255,255,0.04); }
      &:active { background: rgba(255,255,255,0.07); }
    }

    .chat-avatar {
      width: 46px; height: 46px;
      border-radius: 50%;
      background: linear-gradient(135deg, #5b6ef5, #7c3aed);
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 0.92rem;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }

    .chat-info {
      flex: 1;
      min-width: 0;
    }

    .chat-name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #e8eaf6;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chat-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sport-chip {
      font-size: 0.75rem;
      color: #7c86a2;
      background: rgba(255,255,255,0.05);
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.07);
    }

    .chat-date {
      font-size: 0.72rem;
      color: #7c86a2;
    }

    .chat-arrow {
      color: rgba(255,255,255,0.2);
      flex-shrink: 0;
    }

    @media (max-width: 480px) {
      :host { padding: 0; align-items: flex-end; }
      .chats-page { max-width: 100%; max-height: 100dvh; border-radius: 0; }
    }
  `]
})
export class ChatsListComponent implements OnInit {
  private challengeService = inject(ChallengeService);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(true);
  error = signal('');
  activeChats = signal<Challenge[]>([]);

  private readonly SPORT_EMOJIS: Record<string, string> = {
    basketball: '🏀', tennis: '🎾', pickleball: '🏓',
    soccer: '⚽', volleyball: '🏐', badminton: '🏸', cricket: '🏏',
  };

  ngOnInit() {
    const userId = this.authService.currentUserId;
    if (!userId) { this.router.navigate(['/auth']); return; }
    this.loadChats(userId);
  }

  loadChats(userId: string) {
    this.loading.set(true);
    const received: Challenge[] = [];
    const sent: Challenge[] = [];

    this.challengeService.getReceivedChallenges(userId).subscribe({
      next: (res) => {
        received.push(...(res.data || []).filter(c => c.status === 'accepted'));
        this.challengeService.getSentChallenges(userId).subscribe({
          next: (r) => {
            sent.push(...(r.data || []).filter(c => c.status === 'accepted'));

            // Merge and deduplicate by challenge id
            const byId = new Map<string, Challenge>();
            [...received, ...sent].forEach(c => byId.set(c.id, c));

            // Group by opponent user ID — keep most recent challenge per person
            const byOpponent = new Map<string, Challenge>();
            Array.from(byId.values())
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .forEach(c => {
                // Determine the opponent's user id for this challenge
                const opponentId = c.sender_id && c.sender_id !== userId
                  ? c.sender_id
                  : (c.receiver_id || c.profiles?.id || '');
                if (!opponentId) return;
                // First entry per opponent wins (most recent, due to sort above)
                if (!byOpponent.has(opponentId)) {
                  byOpponent.set(opponentId, c);
                }
              });

            this.activeChats.set(Array.from(byOpponent.values()));
            this.loading.set(false);
          },
          error: () => { this.activeChats.set(received); this.loading.set(false); }
        });
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load chats.');
        this.loading.set(false);
      }
    });
  }

  openChat(challenge: Challenge) {
    this.router.navigate(['/chat', challenge.id]);
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  getInitials(challenge: Challenge): string {
    const name = challenge.profiles?.username || 'P';
    return name.slice(0, 2).toUpperCase();
  }

  getSportEmoji(sport: string): string {
    return this.SPORT_EMOJIS[(sport || '').toLowerCase()] || '🏆';
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 86400000;
    if (diff < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 2) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
