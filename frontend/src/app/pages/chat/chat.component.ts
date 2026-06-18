import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  ViewChild,
  ElementRef,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, ChatMessage } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { ChallengeService } from '../../core/services/challenge.service';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface DisplayMessage extends ChatMessage {
  optimistic?: boolean;
  showAvatar?: boolean;
  showDate?: boolean;
  dateLabel?: string;
  status?: MessageStatus;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private challengeService = inject(ChallengeService);
  private ngZone = inject(NgZone);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  challengeId = '';
  currentUserId = '';
  opponentId = '';

  messages = signal<DisplayMessage[]>([]);
  newMessage = signal('');

  loading = signal(true);
  sending = signal(false);
  error = signal('');
  showScrollBtn = signal(false);
  hasNewMessages = signal(false);

  // Challenge metadata for header
  sportName = signal('Match');
  opponentName = signal('Player');
  opponentInitials = signal('P');
  sportEmoji = signal('🏆');

  // Read receipts
  opponentReadAt = signal<Date | null>(null);

  // Presence / Last Seen
  opponentOnline = signal(false);
  opponentLastSeen = signal<string>('');

  private pollInterval: any;
  private presenceInterval: any;
  private readonly SPORT_EMOJIS: Record<string, string> = {
    basketball: '🏀',
    tennis: '🎾',
    pickleball: '🏓',
    soccer: '⚽',
    volleyball: '🏐',
    badminton: '🏸',
    cricket: '🏏',
  };

  ngOnInit() {
    this.currentUserId = this.authService.currentUserId || '';
    if (!this.currentUserId) {
      this.router.navigate(['/auth']);
      return;
    }

    this.route.paramMap.subscribe((params) => {
      this.challengeId = params.get('id') || '';
      if (this.challengeId) {
        this.loadChallengeInfo();
        this.loadMessages();
        // Poll every 2s outside NgZone
        this.ngZone.runOutsideAngular(() => {
          this.pollInterval = setInterval(() => {
            this.ngZone.run(() => this.pollMessages());
          }, 2000);
          // Presence heartbeat every 10s
          this.presenceInterval = setInterval(() => {
            this.sendPresenceHeartbeat();
          }, 10000);
        });
        // Immediate heartbeat
        this.sendPresenceHeartbeat();
      } else {
        this.error.set('Invalid chat session.');
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.presenceInterval) clearInterval(this.presenceInterval);
  }

  loadChallengeInfo() {
    this.challengeService.getReceivedChallenges(this.currentUserId).subscribe({
      next: (res) => {
        const found = res.data?.find((c) => c.id === this.challengeId);
        if (found) {
          this.opponentId = found.sender_id || '';
          this.applyChallengeMeta(found.sport, found.profiles?.username);
          this.loadOpponentPresence();
          return;
        }
        this.challengeService.getSentChallenges(this.currentUserId).subscribe({
          next: (r) => {
            const s = r.data?.find((c) => c.id === this.challengeId);
            if (s) {
              this.opponentId = s.receiver_id || '';
              this.applyChallengeMeta(s.sport, s.profiles?.username);
              this.loadOpponentPresence();
            }
          },
        });
      },
    });
  }

  private applyChallengeMeta(sport: string, opponentUsername?: string) {
    const s = (sport || '').toLowerCase();
    this.sportName.set(sport ? sport.charAt(0).toUpperCase() + sport.slice(1) : 'Match');
    this.sportEmoji.set(this.SPORT_EMOJIS[s] || '🏆');
    const name = opponentUsername || 'Player';
    this.opponentName.set(name);
    this.opponentInitials.set(
      name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    );
  }

  close() {
    this.router.navigate(['/chats']);
  }

  goBack() {
    this.router.navigate(['/chats']);
  }

  loadMessages() {
    this.loading.set(true);
    this.chatService.getMessages(this.challengeId, this.currentUserId).subscribe({
      next: (res) => {
        this.messages.set(this.processMessages(res.data || []));
        this.loading.set(false);
        this.scrollToBottom(true);
        this.markAsRead();
        this.fetchReadStatus();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load messages.');
        this.loading.set(false);
      },
    });
  }

  pollMessages() {
    this.chatService.getMessages(this.challengeId, this.currentUserId).subscribe({
      next: (res) => {
        const incoming = res.data || [];
        const current = this.messages();
        const confirmedIds = new Set(incoming.map((m) => m.id));
        const optimistics = current.filter((m) => m.optimistic && !confirmedIds.has(m.id));
        const merged = [...incoming, ...optimistics];
        merged.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const processed = this.processMessages(merged);
        const prevCount = current.filter((m) => !m.optimistic).length;
        this.messages.set(processed);
        if (incoming.length > prevCount) {
          if (this.showScrollBtn()) {
            this.hasNewMessages.set(true);
          } else {
            this.scrollToBottom(false);
          }
        }
        // Mark as read & fetch opponent's read watermark
        this.markAsRead();
        this.fetchReadStatus();
        // Also refresh presence on each poll
        this.loadOpponentPresence();
      },
    });
  }

  /* ── Read Receipts ── */
  private markAsRead() {
    if (!this.challengeId || !this.currentUserId) return;
    this.chatService.markAsRead(this.challengeId, this.currentUserId).subscribe({
      error: () => {} // silent
    });
  }

  private fetchReadStatus() {
    if (!this.challengeId || !this.currentUserId) return;
    this.chatService.getReadStatus(this.challengeId, this.currentUserId).subscribe({
      next: (res) => {
        const opponentReceipt = (res.data || []).find(r => r.user_id !== this.currentUserId);
        if (opponentReceipt?.last_read_at) {
          this.opponentReadAt.set(new Date(opponentReceipt.last_read_at));
        }
        // Re-process messages to update statuses
        this.messages.update(msgs => this.processMessages(msgs));
      },
      error: () => {}
    });
  }

  /** Compute message delivery/read status for outgoing messages */
  getMessageStatus(msg: DisplayMessage): MessageStatus {
    if (msg.sender_id !== this.currentUserId) return 'sent'; // not mine
    if (msg.optimistic) return 'sending';

    const opponentRead = this.opponentReadAt();
    if (opponentRead) {
      const msgTime = new Date(msg.created_at).getTime();
      if (msgTime <= opponentRead.getTime()) {
        return 'read';
      }
    }
    // If opponent has been seen (presence active), mark as delivered
    if (this.opponentOnline()) {
      return 'delivered';
    }
    return 'sent';
  }

  /* ── Presence ── */
  private sendPresenceHeartbeat() {
    if (!this.currentUserId) return;
    this.chatService.sendPresenceHeartbeat(this.currentUserId).subscribe({
      error: () => {} // silent
    });
  }

  private loadOpponentPresence() {
    if (!this.opponentId) return;
    this.chatService.getPresence(this.opponentId).subscribe({
      next: (res) => {
        const lastSeen = res.data?.last_seen_at;
        if (!lastSeen) {
          this.opponentOnline.set(false);
          this.opponentLastSeen.set('');
          return;
        }

        const lastSeenDate = new Date(lastSeen);
        const diffSec = (Date.now() - lastSeenDate.getTime()) / 1000;

        if (diffSec < 30) {
          this.opponentOnline.set(true);
          this.opponentLastSeen.set('Online');
        } else {
          this.opponentOnline.set(false);
          this.opponentLastSeen.set(this.formatLastSeen(lastSeenDate));
        }
      },
      error: () => {
        this.opponentOnline.set(false);
        this.opponentLastSeen.set('');
      }
    });
  }

  formatLastSeen(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Last seen just now';
    if (diffMin < 60) return `Last seen ${diffMin}m ago`;
    if (diffHr < 24) return `Last seen ${diffHr}h ago`;
    if (diffDays === 1) return 'Last seen yesterday';
    return `Last seen ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  }

  sendMessage() {
    const text = this.newMessage().trim();
    if (!text || this.sending()) return;

    const optimisticMsg: DisplayMessage = {
      id: `opt-${Date.now()}`,
      sender_id: this.currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    this.messages.update((m) => this.processMessages([...m, optimisticMsg]));
    this.newMessage.set('');
    this.scrollToBottom(false);
    this.sending.set(true);

    this.chatService.sendMessage(this.challengeId, this.currentUserId, text).subscribe({
      next: (res) => {
        if (res.data) {
          this.messages.update((msgs) => {
            const replaced = msgs.filter((m) => m.id !== optimisticMsg.id);
            return this.processMessages([...replaced, res.data]);
          });
        }
        this.sending.set(false);
        this.scrollToBottom(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to send message.');
        this.sending.set(false);
        this.messages.update((msgs) => this.processMessages(msgs.filter((m) => m.id !== optimisticMsg.id)));
      },
    });
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onMessagesScroll(event: Event) {
    const el = event.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 80;
    this.showScrollBtn.set(!isNearBottom);
    if (isNearBottom) {
      this.hasNewMessages.set(false);
    }
  }

  scrollToBottomClick() {
    this.hasNewMessages.set(false);
    this.scrollToBottom(true);
  }

  /** Process raw messages → add date dividers, avatar grouping, and delivery status */
  private processMessages(msgs: DisplayMessage[]): DisplayMessage[] {
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    return sorted.map((msg, i) => {
      // System messages render as event dividers — skip bubble logic
      if (msg.is_system) {
        return { ...msg, showDate: false, showAvatar: false };
      }

      const prev = sorted[i - 1];
      // Skip system messages when computing date/avatar grouping
      const prevReal = sorted.slice(0, i).reverse().find(m => !m.is_system);
      const msgDay   = this.toLocalDateStr(msg.created_at);
      const prevDay  = prevReal ? this.toLocalDateStr(prevReal.created_at) : null;
      const showDate = !prevDay || prevDay !== msgDay;
      const showAvatar =
        msg.sender_id !== this.currentUserId &&
        (!prevReal || prevReal.sender_id !== msg.sender_id || showDate);
      return {
        ...msg,
        showDate,
        showAvatar,
        dateLabel: showDate ? this.formatDateDivider(msgDay) : undefined,
        status: this.getMessageStatus(msg),
      };
    });
  }

  private toLocalDateStr(dateStr: string): string {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatDateDivider(localDateStr: string): string {
    const now = new Date();
    const todayStr = this.toLocalDateStr(now.toISOString());
    const yd = new Date(now);
    yd.setDate(yd.getDate() - 1);
    const yesterdayStr = this.toLocalDateStr(yd.toISOString());

    if (localDateStr === todayStr) return 'Today';
    if (localDateStr === yesterdayStr) return 'Yesterday';

    const [y, mo, d] = localDateStr.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  isMine(msg: ChatMessage): boolean {
    if (!msg.sender_id) return false; // system messages have no sender
    return msg.sender_id === this.currentUserId;
  }

  trackById(_: number, msg: DisplayMessage): string {
    return msg.id;
  }

  private scrollToBottom(force: boolean) {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      }
    }, 60);
  }
}
