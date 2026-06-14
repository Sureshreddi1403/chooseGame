import { Routes } from '@angular/router';
import { AuthPageComponent } from './pages/auth-page/auth-page.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { PlayersDashboardComponent } from './pages/players-dashboard/players-dashboard.component';
import { PlayerProfileComponent } from './pages/player-profile/player-profile.component';

export const routes: Routes = [
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'auth', component: AuthPageComponent },
  { path: 'home', component: HomePageComponent },
  { path: 'players', component: PlayersDashboardComponent },
  { path: 'profile', component: PlayerProfileComponent },
];

