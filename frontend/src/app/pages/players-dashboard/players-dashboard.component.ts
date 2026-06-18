import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PlayerService, Player } from '../../core/services/player.service';
import { AuthService } from '../../core/services/auth.service';
import { ChallengeService, Challenge } from '../../core/services/challenge.service';
import { environment } from '../../../environments/environment';
import { RequestsBoardComponent } from '../requests-board/requests-board.component';

interface SportFilter {
  label: string;
  value: string;
  icon: string;
}

interface DistanceFilter {
  label: string;
  value: number; // 0 = any
}

@Component({
  selector: 'app-players-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RequestsBoardComponent, RouterModule],
  templateUrl: './players-dashboard.component.html',
  styleUrl: './players-dashboard.component.scss',
})
export class PlayersDashboardComponent implements OnInit, OnDestroy {
  private playerService = inject(PlayerService);
  private authService = inject(AuthService);
  private challengeService = inject(ChallengeService);
  private router = inject(Router);

  /* ── State ── */
  loading = signal(true);
  locationLoading = signal(false);
  locationError = signal('');
  selectedSport = signal('all');
  selectedDistance = signal(0); // 0 = any
  players = signal<Player[]>([]);
  selectedPlayer = signal<Player | null>(null);
  searchQuery = '';

  /* ── Challenge Modal ── */
  showChallengeModal = signal(false);
  challengeLoading = signal(false);
  challengeMessage = signal('');
  challengeSport = signal('');
  challengeError = signal('');
  challengeSuccess = signal(false);

  // Requests Sidebar
  showRequestsSidebar = false;

  /* ── Sent challenge tracking ── */
  sentChallengesMap = signal<Map<string, Challenge>>(new Map());

  private _userLat?: number;
  private _userLng?: number;
  private _map: any = null;
  private _markers: any[] = [];
  private _activeInfoWindow: any = null;

  sports: SportFilter[] = [
    { label: 'All Sports', value: 'all',        icon: '🏆' },
    { label: 'Basketball', value: 'basketball', icon: '🏀' },
    { label: 'Tennis',     value: 'tennis',     icon: '🎾' },
    { label: 'Pickleball', value: 'pickleball', icon: '🏓' },
    { label: 'Soccer',     value: 'soccer',     icon: '⚽' },
    { label: 'Volleyball', value: 'volleyball', icon: '🏐' },
    { label: 'Baseball',   value: 'baseball',   icon: '⚾' },
    { label: 'Swimming',   value: 'swimming',   icon: '🏊' },
    { label: 'Golf',       value: 'golf',       icon: '⛳' },
  ];

  distanceFilters: DistanceFilter[] = [
    { label: 'Any distance', value: 0 },
    { label: '< 5 km',       value: 5 },
    { label: '< 10 km',      value: 10 },
    { label: '< 25 km',      value: 25 },
    { label: '< 50 km',      value: 50 },
    { label: '< 100 km',     value: 100 },
  ];

  get filteredPlayers(): Player[] {
    const q = this.searchQuery.trim().toLowerCase();
    const maxDist = this.selectedDistance();
    return this.players().filter(p => {
      // text search
      const matchesText = !q ||
        p.username.toLowerCase().includes(q) ||
        (p.sport_preferences || []).some(s => s.toLowerCase().includes(q)) ||
        (p.skill_level || '').toLowerCase().includes(q);
      // distance filter
      const matchesDist = maxDist === 0 || (p.distanceKm != null && p.distanceKm <= maxDist);
      return matchesText && matchesDist;
    });
  }

  get activeSportLabel(): string {
    return this.sports.find(s => s.value === this.selectedSport())?.label || 'All Sports';
  }

  primarySport(p: Player): string {
    return (p.sport_preferences || [])[0] || '';
  }

  async ngOnInit() {
    (window as any).challengePlayer = (id: string) => {
      const p = this.players().find(pl => pl.id === id);
      if (p) {
        this.openChallengeModal(p);
      }
    };

    await this.detectLocation();
    this.loadPlayers();
    this.loadSentChallenges();
  }

  ngOnDestroy() {
    this._markers = [];
    this._map = null;
  }

  /* ── Location ── */
  async detectLocation() {
    if (!navigator.geolocation) return;
    this.locationLoading.set(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      this._userLat = pos.coords.latitude;
      this._userLng = pos.coords.longitude;
    } catch {
      this._userLat = 17.4400;
      this._userLng = 78.4900;
      this.locationError.set('Using default location (Hyderabad). Allow location access for accurate distances.');
    } finally {
      this.locationLoading.set(false);
    }
  }

  /* ── Players ── */
  loadPlayers() {
    this.loading.set(true);
    const userId = this.authService.currentUserId;

    this.playerService.getPlayers(this.selectedSport(), this._userLat, this._userLng).subscribe({
      next: (res) => {
        let withDist = res.data.map(p => ({
          ...p,
          distanceKm: p.distanceKm ?? (
            this._userLat != null && this._userLng != null
              ? this.distanceKm(this._userLat, this._userLng, p.player_lat, p.player_lng)
              : undefined
          ),
        }));

        if (userId) {
          withDist = withDist.filter(p => p.id !== userId);
        }

        withDist.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
        
        this.players.set(withDist);
        this.loading.set(false);
        this.renderMap();
      },
      error: () => this.loading.set(false),
    });
  }

  selectSport(sport: string) {
    this.selectedSport.set(sport);
    this.selectedPlayer.set(null);
    this.loadPlayers();
  }

  selectDistance(dist: number) {
    this.selectedDistance.set(dist);
  }

  selectPlayer(player: Player) {
    this.selectedPlayer.set(player);
    this.panMapTo(player.player_lat, player.player_lng);
  }

  unselectPlayer() {
    this.selectedPlayer.set(null);
    if (this._activeInfoWindow) {
      this._activeInfoWindow.close();
      this._activeInfoWindow = null;
    }
    if (this._map) {
      setTimeout(() => {
        this._map.panTo({ lat: this._userLat ?? 17.4400, lng: this._userLng ?? 78.4900 });
        this._map.setZoom(13); // Zoom out back to default
      }, 50); // wait for container to resize
    }
  }

  /* ── Map ── */
  async renderMap() {
    if (!environment.googleMapsApiKey) return;
    try {
      await this.loadGoogleMaps(environment.googleMapsApiKey);
      const mapEl = document.getElementById('players-map');
      if (!mapEl) return;

      const center = {
        lat: this._userLat ?? 17.4400,
        lng: this._userLng ?? 78.4900,
      };

      if (!this._map) {
        this._map = new (window as any).google.maps.Map(mapEl, {
          center,
          zoom: 13,
          styles: this.mapStyles(),
          disableDefaultUI: true,
          zoomControl: true,
        });
      }

      // Clear old markers
      this._markers.forEach(m => m.setMap(null));
      this._markers = [];

      // User pin
      if (this._userLat && this._userLng) {
        const userMarker = new (window as any).google.maps.Marker({
          position: center,
          map: this._map,
          icon: {
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#1d4ed8',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          title: 'You are here',
          zIndex: 999,
        });
        this._markers.push(userMarker);
      }

      // Player pins
      this.players().forEach(p => {
        const color = this.sportAccent(this.primarySport(p));

        const marker = new (window as any).google.maps.Marker({
          position: { lat: p.player_lat, lng: p.player_lng },
          map: this._map,
          title: p.username,
          icon: {
            path: (window as any).google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        const infoWindow = new (window as any).google.maps.InfoWindow({
          content: `
            <div style="font-family:Inter,sans-serif;padding:8px 4px;min-width:140px">
              <strong style="color:#0f172a">${p.username}</strong>
              <p style="margin:4px 0 2px;color:#64748b;font-size:13px;text-transform:capitalize">${(p.sport_preferences || []).join(', ') || 'N/A'}</p>
              <p style="margin:0;color:#1d4ed8;font-size:13px;font-weight:700">⭐ ${p.rating || 'N/A'}</p>
              ${p.distanceKm != null ? `<p style="margin:4px 0 0;color:#475569;font-size:12px">📍 ${p.distanceKm.toFixed(1)} km away</p>` : ''}
            </div>`,
        });

        marker.addListener('click', () => {
          if (this._activeInfoWindow) {
            this._activeInfoWindow.close();
          }
          this.selectPlayer(p);
          infoWindow.open(this._map, marker);
          this._activeInfoWindow = infoWindow;
        });

        this._markers.push(marker);
      });
    } catch (e) {
      console.warn('Map failed to load', e);
    }
  }

  panMapTo(lat: number, lng: number) {
    if (this._map) {
      this._map.panTo({ lat, lng });
      this._map.setZoom(15);
    }
  }

  loadGoogleMaps(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.maps) return resolve();
      const existing = document.getElementById('gmap-script');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.id = 'gmap-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.defer = true;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /* ── Helpers ── */
  distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  starArray(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  sportIcon(sport: string): string {
    const icons: Record<string, string> = {
      basketball: '🏀', tennis: '🎾', pickleball: '🏓',
      soccer: '⚽', volleyball: '🏐',
      baseball: '⚾', swimming: '🏊', golf: '⛳',
    };
    return icons[sport] || '🏆';
  }

  sportColor(sport: string): string {
    const colors: Record<string, string> = {
      basketball: '#fff7ed',
      tennis:     '#f0fdf4',
      pickleball: '#faf5ff',
      soccer:     '#ecfeff',
      volleyball: '#fefce8',
      baseball:   '#fef2f2',
      swimming:   '#eff6ff',
      golf:       '#ecfdf5',
    };
    return colors[sport] || '#f8fafc';
  }

  sportAccent(sport: string): string {
    const colors: Record<string, string> = {
      basketball: '#f97316',
      tennis:     '#22c55e',
      pickleball: '#a855f7',
      soccer:     '#06b6d4',
      volleyball: '#eab308',
      baseball:   '#ef4444',
      swimming:   '#3b82f6',
      golf:       '#10b981',
    };
    return colors[sport] || '#64748b';
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  trackById(_: number, p: Player) { return p.id; }

  /* ── Sent Challenges ── */
  loadSentChallenges() {
    const userId = this.authService.currentUserId;
    if (!userId) return;
    this.challengeService.getSentChallenges(userId).subscribe({
      next: (res) => {
        const map = new Map<string, Challenge>();
        for (const c of (res.data || [])) {
          const rid = c.receiver_id;
          if (!rid) continue;
          // Keep most recent challenge per receiver (they arrive sorted already)
          const existing = map.get(rid);
          if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
            map.set(rid, c);
          }
        }
        this.sentChallengesMap.set(map);
      },
      error: () => {} // silent
    });
  }

  /** Get the latest sent challenge to this player (if any, non-rejected) */
  getChallengeForPlayer(playerId: string): Challenge | null {
    const c = this.sentChallengesMap().get(playerId);
    if (!c) return null;
    // If rejected, treat as no challenge (allow re-sending)
    if (c.status === 'rejected') return null;
    return c;
  }

  /** Whether a challenge button should be disabled for this player */
  canChallenge(playerId: string): boolean {
    return !this.getChallengeForPlayer(playerId);
  }

  mapStyles() {
    return [
      { elementType: 'geometry',   stylers: [{ color: '#f1f5f9' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
      { featureType: 'water',      elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
      { featureType: 'road',       elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road',       elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
      { featureType: 'poi',        stylers: [{ visibility: 'off' }] },
      { featureType: 'transit',    stylers: [{ visibility: 'off' }] },
    ];
  }

  toggleRequests() {
    this.showRequestsSidebar = !this.showRequestsSidebar;
  }

  /* ── Challenge Logic ── */
  openChallengeModal(player: Player, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedPlayer.set(player);
    this.challengeSport.set(this.primarySport(player) || 'all');
    this.challengeMessage.set('');
    this.challengeError.set('');
    this.challengeSuccess.set(false);
    this.showChallengeModal.set(true);
  }

  closeChallengeModal() {
    this.showChallengeModal.set(false);
  }

  submitChallenge() {
    const sender_id = this.authService.currentUserId;
    const receiver_id = this.selectedPlayer()?.id;
    const sport = this.challengeSport();
    
    if (!sender_id || !receiver_id) {
      this.challengeError.set('You must be logged in to send a challenge.');
      return;
    }
    if (!sport || sport === 'all') {
      this.challengeError.set('Please select a specific sport.');
      return;
    }

    this.challengeLoading.set(true);
    this.challengeError.set('');

    this.challengeService.createChallenge({
      sender_id,
      receiver_id,
      sport,
      message: this.challengeMessage()
    }).subscribe({
      next: () => {
        this.challengeLoading.set(false);
        this.challengeSuccess.set(true);
        this.loadSentChallenges(); // refresh the map
        setTimeout(() => this.closeChallengeModal(), 2000);
      },
      error: (err) => {
        this.challengeLoading.set(false);
        this.challengeError.set(err.error?.message || 'Failed to send challenge.');
      }
    });
  }
}
