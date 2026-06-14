import { Component, OnInit, inject, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChallengeService, Challenge } from '../../core/services/challenge.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-requests-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './requests-board.component.html',
  styleUrl: './requests-board.component.scss',
})
export class RequestsBoardComponent implements OnInit {
  private challengeService = inject(ChallengeService);
  private authService = inject(AuthService);
  private router = inject(Router);

  @Output() close = new EventEmitter<void>();

  activeTab = signal<'received' | 'sent'>('received');
  loading = signal(true);
  error = signal('');
  
  receivedChallenges = signal<Challenge[]>([]);
  sentChallenges = signal<Challenge[]>([]);

  ngOnInit() {
    this.loadChallenges();
  }

  closeSidebar() {
    this.close.emit();
  }

  switchTab(tab: 'received' | 'sent') {
    this.activeTab.set(tab);
    this.loadChallenges();
  }

  loadChallenges() {
    const userId = this.authService.currentUserId;
    if (!userId) {
      this.router.navigate(['/auth']);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (this.activeTab() === 'received') {
      this.challengeService.getReceivedChallenges(userId).subscribe({
        next: (res) => {
          this.receivedChallenges.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to load received challenges');
          this.loading.set(false);
        }
      });
    } else {
      this.challengeService.getSentChallenges(userId).subscribe({
        next: (res) => {
          this.sentChallenges.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to load sent challenges');
          this.loading.set(false);
        }
      });
    }
  }

  updateStatus(challengeId: string, status: 'accepted' | 'rejected') {
    const userId = this.authService.currentUserId;
    if (!userId) return;

    this.loading.set(true);
    this.challengeService.updateChallengeStatus(challengeId, status, userId).subscribe({
      next: () => {
        this.loadChallenges(); // Reload
      },
      error: (err) => {
        this.error.set(err.error?.message || `Failed to ${status} challenge`);
        this.loading.set(false);
      }
    });
  }

  openChat(challenge: Challenge) {
    // We'll navigate to the chat component with the challenge ID
    // E.g. /chat/CHALLENGE_ID
    this.router.navigate(['/chat', challenge.id]);
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getSportIcon(sport: string): string {
    const icons: Record<string, string> = {
      basketball: '🏀', tennis: '🎾', pickleball: '🏓',
      soccer: '⚽', volleyball: '🏐',
    };
    return icons[sport] || '🏆';
  }
}
