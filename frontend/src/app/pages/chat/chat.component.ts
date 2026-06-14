import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, ChatMessage } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';

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

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  challengeId = '';
  currentUserId = '';
  
  messages = signal<ChatMessage[]>([]);
  newMessage = signal('');
  
  loading = signal(true);
  sending = signal(false);
  error = signal('');
  
  private pollInterval: any;

  ngOnInit() {
    this.currentUserId = this.authService.currentUserId || '';
    if (!this.currentUserId) {
      this.router.navigate(['/auth']);
      return;
    }

    this.route.paramMap.subscribe(params => {
      this.challengeId = params.get('id') || '';
      if (this.challengeId) {
        this.loadMessages();
        // Simple polling every 3 seconds
        this.pollInterval = setInterval(() => this.pollMessages(), 3000);
      } else {
        this.error.set('Invalid chat session.');
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  goBack() {
    this.router.navigate(['/requests']);
  }

  loadMessages() {
    this.loading.set(true);
    this.chatService.getMessages(this.challengeId, this.currentUserId).subscribe({
      next: (res) => {
        this.messages.set(res.data || []);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load messages.');
        this.loading.set(false);
      }
    });
  }

  pollMessages() {
    this.chatService.getMessages(this.challengeId, this.currentUserId).subscribe({
      next: (res) => {
        const prevCount = this.messages().length;
        this.messages.set(res.data || []);
        if (res.data && res.data.length > prevCount) {
          this.scrollToBottom();
        }
      }
    });
  }

  sendMessage() {
    const text = this.newMessage().trim();
    if (!text) return;

    this.sending.set(true);
    this.chatService.sendMessage(this.challengeId, this.currentUserId, text).subscribe({
      next: (res) => {
        if (res.data) {
          this.messages.update(m => [...m, res.data]);
        }
        this.newMessage.set('');
        this.sending.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to send message.');
        this.sending.set(false);
      }
    });
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }
}
