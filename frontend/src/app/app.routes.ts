import { Routes } from '@angular/router';
import { AuthPageComponent } from './pages/auth-page/auth-page.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { PlayersDashboardComponent } from './pages/players-dashboard/players-dashboard.component';
import { PlayerProfileComponent } from './pages/player-profile/player-profile.component';
import { RequestsBoardComponent } from './pages/requests-board/requests-board.component';
import { ChatComponent } from './pages/chat/chat.component';
import { ChatsListComponent } from './pages/chats-list/chats-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'auth', component: AuthPageComponent },
  { path: 'home', component: HomePageComponent },
  { path: 'players', component: PlayersDashboardComponent },
  { path: 'profile', component: PlayerProfileComponent },
  { path: 'chat/:id', component: ChatComponent },
  { path: 'chats', component: ChatsListComponent },
];

