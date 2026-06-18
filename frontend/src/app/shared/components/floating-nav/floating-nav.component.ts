import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

/**
 * Floating navigation bar — shown on all app pages EXCEPT auth, root, and chat windows.
 * Auth check is intentionally removed: each page guards itself, and checking localStorage
 * here caused the nav to be hidden in Firefox/Brave because they have separate localStorage
 * namespaces per profile, and `pg_user_id` may not be set in a fresh Firefox session.
 */
@Component({
  selector: 'app-floating-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    @if (showNav()) {
      <nav class="floating-nav">
        <a routerLink="/home" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Home</span>
        </a>
        <a routerLink="/players" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📍</span>
          <span class="nav-label">Find</span>
        </a>
        <a routerLink="/chats" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">💬</span>
          <span class="nav-label">Chats</span>
        </a>
        <a routerLink="/profile" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">👤</span>
          <span class="nav-label">Profile</span>
        </a>
      </nav>
    }
  `,
  styles: [`
    :host {
      display: contents; /* don't create an extra layout box */
    }

    .floating-nav {
      /* Cross-browser centering: avoid transform on fixed elements (breaks in Firefox/Brave) */
      position: fixed;
      bottom: 24px;
      left: 0;
      right: 0;
      width: fit-content;
      margin-left: auto;
      margin-right: auto;

      display: flex;
      align-items: center;
      gap: 8px;

      /* Solid background fallback first, then glassy override for Chrome/Safari */
      background: rgba(255, 255, 255, 0.96);
      @supports (backdrop-filter: blur(1px)) {
        background: rgba(255, 255, 255, 0.88);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
      }

      padding: 8px;
      border-radius: 999px;
      box-shadow:
        0 10px 40px rgba(15, 23, 42, 0.15),
        0 0 0 1px rgba(255, 255, 255, 0.5);
      z-index: 10000;
      border: 1px solid rgba(226, 232, 240, 0.8);
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 999px;
      text-decoration: none;
      color: #64748b;
      font-weight: 700;
      font-size: 0.9rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .nav-icon {
      font-size: 1.1rem;
    }

    .nav-label {
      display: inline-block;
      max-width: 0;
      overflow: hidden;
      opacity: 0;
      transition: max-width 0.3s ease, opacity 0.3s ease, margin 0.3s ease;
    }

    .nav-item:hover {
      color: #2563eb;
      background: rgba(239, 246, 255, 0.7);
    }

    .nav-item.active {
      color: white;
      background: linear-gradient(135deg, #2563eb, #1e40af);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .nav-item.active .nav-label {
      max-width: 80px;
      opacity: 1;
      margin-left: 2px;
    }

    @media (max-width: 640px) {
      .floating-nav {
        width: calc(100% - 32px);
        left: 16px;
        right: 16px;
        margin: 0;
        justify-content: space-around;
        padding: 8px 4px;
        bottom: 16px;
      }
      .nav-item {
        flex: 1;
        justify-content: center;
        padding: 10px 8px;
      }
    }
  `]
})
export class FloatingNavComponent {
  private router = inject(Router);

  /** Routes where the nav should be hidden */
  private readonly HIDDEN_ROUTES = new Set(['', '/', '/auth']);

  /** Signal updated on every navigation event */
  private currentUrl = signal(this.getCleanUrl(this.router.url));

  /** Derived — re-evaluates whenever currentUrl signal changes */
  showNav = computed(() => {
    const url = this.currentUrl();
    if (this.HIDDEN_ROUTES.has(url)) return false;
    if (url.startsWith('/chat/')) return false; // individual chat windows
    return true;
  });

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.currentUrl.set(this.getCleanUrl(e.urlAfterRedirects));
    });
  }

  private getCleanUrl(url: string): string {
    return (url || '').split('?')[0].split('#')[0];
  }
}
