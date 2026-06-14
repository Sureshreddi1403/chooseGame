import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService, Player } from '../../core/services/player.service';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './players-dashboard.component.html',
  styleUrl: './players-dashboard.component.scss',
})
export class PlayersDashboardComponent implements OnInit, OnDestroy {
  private playerService = inject(PlayerService);
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

  private _userLat?: number;
  private _userLng?: number;
  private _map: any = null;
  private _markers: any[] = [];

  sports: SportFilter[] = [
    { label: 'All Sports', value: 'all',        icon: '🏆' },
    { label: 'Basketball', value: 'basketball',  icon: '🏀' },
    { label: 'Tennis',     value: 'tennis',      icon: '🎾' },
    { label: 'Pickleball', value: 'pickleball',  icon: '🏓' },
    { label: 'Soccer',     value: 'soccer',      icon: '⚽' },
    { label: 'Volleyball', value: 'volleyball',  icon: '🏐' },
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
    await this.detectLocation();
    this.loadPlayers();
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
    this.playerService.getPlayers(this.selectedSport(), this._userLat, this._userLng).subscribe({
      next: (res) => {
        const withDist = res.data.map(p => ({
          ...p,
          distanceKm: p.distanceKm ?? (
            this._userLat != null && this._userLng != null
              ? this.distanceKm(this._userLat, this._userLng, p.player_lat, p.player_lng)
              : undefined
          ),
        })).sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
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
        const sportColors: Record<string, string> = {
          basketball: '#f97316',
          tennis:     '#22c55e',
          pickleball: '#a855f7',
          soccer:     '#06b6d4',
          volleyball: '#eab308',
        };
        const color = sportColors[this.primarySport(p)] || '#64748b';

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
          this.selectPlayer(p);
          infoWindow.open(this._map, marker);
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
    };
    return colors[sport] || '#1d4ed8';
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  trackById(_: number, p: Player) { return p.id; }

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
}
