import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-floating-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="floating-nav" *ngIf="shouldShowNav()">
      <a routerLink="/home" routerLinkActive="active" class="nav-item">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">Home</span>
      </a>
      <a routerLink="/players" routerLinkActive="active" class="nav-item">
        <span class="nav-icon">📍</span>
        <span class="nav-label">Find</span>
      </a>
      <a routerLink="/profile" routerLinkActive="active" class="nav-item">
        <span class="nav-icon">👤</span>
        <span class="nav-label">Profile</span>
      </a>
    </nav>
  `,
  styles: [`
    .floating-nav {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 8px;
      border-radius: 999px;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
      z-index: 9999;
      border: 1px solid rgba(226, 232, 240, 0.8);
      transition: all 0.3s ease;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--slate-500, #64748b);
      font-weight: 700;
      font-size: 0.9rem;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
    }

    .nav-icon {
      font-size: 1.1rem;
      transition: transform 0.2s ease;
    }

    .nav-label {
      opacity: 0;
      width: 0;
      overflow: hidden;
      white-space: nowrap;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      transform: translateX(-10px);
    }

    .nav-item:hover {
      color: var(--blue-600, #2563eb);
      background: rgba(239, 246, 255, 0.5);
      .nav-icon { transform: scale(1.1); }
    }

    .nav-item.active {
      color: white;
      background: linear-gradient(135deg, var(--blue-600, #2563eb), var(--blue-800, #1e40af));
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);

      .nav-label {
        opacity: 1;
        width: auto;
        transform: translateX(0);
        margin-left: 2px;
      }
      
      .nav-icon { transform: scale(1.1); }
    }
    
    @media (max-width: 640px) {
      .floating-nav {
        width: calc(100% - 48px);
        justify-content: space-between;
        padding: 8px 12px;
        bottom: 16px;
      }
      .nav-item {
        flex: 1;
        justify-content: center;
        padding: 10px 12px;
      }
      .nav-item.active .nav-label {
        font-size: 0.85rem;
      }
    }
  `]
})
export class FloatingNavComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  private hiddenRoutes = ['/', '/auth'];
  currentUrl = '';

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.currentUrl = e.urlAfterRedirects.split('?')[0];
    });
  }

  shouldShowNav(): boolean {
    if (!this.authService.currentUserId) return false;
    return !this.hiddenRoutes.includes(this.currentUrl);
  }
}
