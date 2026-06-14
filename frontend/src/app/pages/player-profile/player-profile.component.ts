import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService, PlayerProfile, ProfileUpdatePayload } from '../../core/services/player.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface SportOption {
  label: string;
  value: string;
  icon: string;
}

@Component({
  selector: 'app-player-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-profile.component.html',
  styleUrl: './player-profile.component.scss',
})
export class PlayerProfileComponent implements OnInit, OnDestroy {
  private playerService = inject(PlayerService);
  private authService = inject(AuthService);
  private router = inject(Router);

  /* ── UI state ── */
  loading = signal(true);
  saving = signal(false);
  saveSuccess = signal(false);
  saveError = signal('');
  locationTab = signal<'gps' | 'map'>('gps');
  gpsLoading = signal(false);
  gpsError = signal('');
  mapReady = signal(false);

  /* ── Form model ── */
  profile: Partial<PlayerProfile> = {};
  bio = '';
  skillLevel = '';
  sportPrefs: string[] = [];
  playerLat: number | null = null;
  playerLng: number | null = null;
  locationLabel = '';
  isDiscoverable = false;

  /* ── Map ── */
  private _map: any = null;
  private _pin: any = null;
  private _autocomplete: any = null;
  private _geocoder: any = null;

  sports: SportOption[] = [
    { label: 'Basketball', value: 'basketball', icon: '🏀' },
    { label: 'Tennis',     value: 'tennis',     icon: '🎾' },
    { label: 'Pickleball', value: 'pickleball', icon: '🏓' },
    { label: 'Soccer',     value: 'soccer',     icon: '⚽' },
    { label: 'Volleyball', value: 'volleyball', icon: '🏐' },
    { label: 'Baseball',   value: 'baseball',   icon: '⚾' },
    { label: 'Swimming',   value: 'swimming',   icon: '🏊' },
    { label: 'Golf',       value: 'golf',       icon: '⛳' },
  ];

  skillLevels = [
    { label: 'Beginner',     value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced',     value: 'advanced' },
    { label: 'Pro',          value: 'pro' },
  ];

  get userId(): string | null {
    return this.authService.currentUserId;
  }

  get initials(): string {
    const name = (this.profile.username || this.profile.first_name || '??');
    return name.slice(0, 2).toUpperCase();
  }

  async ngOnInit() {
    if (!this.userId) {
      this.router.navigate(['/auth']);
      return;
    }
    await this.loadProfile();
    if (this.locationTab() === 'map') {
      await this.initMap();
    }
  }

  ngOnDestroy() {
    this._map = null;
    this._pin = null;
  }

  /* ── Load profile ── */
  async loadProfile() {
    this.loading.set(true);
    this.playerService.getProfile(this.userId!).subscribe({
      next: (res) => {
        this.profile = res.data;
        this.bio = res.data.bio ?? '';
        this.skillLevel = res.data.skill_level ?? '';
        this.sportPrefs = res.data.sport_preferences ?? [];
        this.playerLat = res.data.player_lat ?? null;
        this.playerLng = res.data.player_lng ?? null;
        this.locationLabel = res.data.player_location_label ?? '';
        this.isDiscoverable = res.data.is_discoverable ?? false;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /* ── Sport toggles ── */
  toggleSport(sport: string) {
    if (this.sportPrefs.includes(sport)) {
      this.sportPrefs = this.sportPrefs.filter(s => s !== sport);
    } else {
      this.sportPrefs = [...this.sportPrefs, sport];
    }
  }

  /* ── Location: GPS ── */
  useGps() {
    this.gpsLoading.set(true);
    this.gpsError.set('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        this.playerLat = pos.coords.latitude;
        this.playerLng = pos.coords.longitude;
        this.locationLabel = await this.reverseGeocode(this.playerLat!, this.playerLng!);
        this.gpsLoading.set(false);
      },
      (err) => {
        this.gpsError.set('Could not get location. Please allow location access and try again.');
        this.gpsLoading.set(false);
      },
      { timeout: 8000 }
    );
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      await this.loadGoogleMaps(environment.googleMapsApiKey);
      if (!this._geocoder) {
        this._geocoder = new (window as any).google.maps.Geocoder();
      }
      return new Promise((resolve) => {
        this._geocoder.geocode(
          { location: { lat, lng } },
          (results: any[], status: string) => {
            if (status === 'OK' && results[0]) {
              resolve(results[0].formatted_address);
            } else {
              resolve(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
          }
        );
      });
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  /* ── Location: Map ── */
  async switchToMap() {
    this.locationTab.set('map');
    setTimeout(() => this.initMap(), 100);
  }

  switchToGps() {
    this.locationTab.set('gps');
  }

  async initMap() {
    if (!environment.googleMapsApiKey) {
      this.gpsError.set('Google Maps API key not configured.');
      return;
    }
    try {
      await this.loadGoogleMaps(environment.googleMapsApiKey);
      const mapEl = document.getElementById('profile-map');
      if (!mapEl) return;

      const center = {
        lat: this.playerLat ?? 17.4400,
        lng: this.playerLng ?? 78.4900,
      };

      this._map = new (window as any).google.maps.Map(mapEl, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: this.mapStyles(),
      });

      // Drop existing pin if location already set
      if (this.playerLat && this.playerLng) {
        this.dropPin(this.playerLat, this.playerLng);
      }

      // Click to set pin
      this._map.addListener('click', async (e: any) => {
        const lat: number = e.latLng.lat();
        const lng: number = e.latLng.lng();
        this.playerLat = lat;
        this.playerLng = lng;
        this.dropPin(lat, lng);
        this.locationLabel = await this.reverseGeocode(lat, lng);
      });

      // Autocomplete search box
      const searchInput = document.getElementById('map-search-input') as HTMLInputElement;
      if (searchInput) {
        this._autocomplete = new (window as any).google.maps.places.Autocomplete(searchInput, {
          types: ['geocode', 'establishment'],
        });
        this._autocomplete.addListener('place_changed', async () => {
          const place = this._autocomplete.getPlace();
          if (!place.geometry) return;
          const lat: number = place.geometry.location.lat();
          const lng: number = place.geometry.location.lng();
          this.playerLat = lat;
          this.playerLng = lng;
          this.locationLabel = place.formatted_address || place.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          this.dropPin(lat, lng);
          this._map.setCenter({ lat, lng });
          this._map.setZoom(15);
        });
      }

      this.mapReady.set(true);
    } catch (e) {
      console.warn('Map init error', e);
    }
  }

  dropPin(lat: number, lng: number) {
    if (this._pin) this._pin.setMap(null);
    this._pin = new (window as any).google.maps.Marker({
      position: { lat, lng },
      map: this._map,
      draggable: true,
      icon: {
        path: (window as any).google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#1d4ed8',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      title: 'Your playing location',
    });

    this._pin.addListener('dragend', async (e: any) => {
      this.playerLat = e.latLng.lat();
      this.playerLng = e.latLng.lng();
      this.locationLabel = await this.reverseGeocode(this.playerLat!, this.playerLng!);
    });
  }

  clearLocation() {
    this.playerLat = null;
    this.playerLng = null;
    this.locationLabel = '';
    if (this._pin) {
      this._pin.setMap(null);
      this._pin = null;
    }
  }

  /* ── Save profile ── */
  save() {
    if (!this.userId) return;
    this.saving.set(true);
    this.saveError.set('');
    this.saveSuccess.set(false);

    const payload: ProfileUpdatePayload = {
      userId: this.userId,
      bio: this.bio,
      skill_level: this.skillLevel,
      sport_preferences: this.sportPrefs,
      player_lat: this.playerLat,
      player_lng: this.playerLng,
      player_location_label: this.locationLabel,
      is_discoverable: this.isDiscoverable,
    };

    this.playerService.updateProfile(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 4000);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err.error?.message ?? 'Failed to save profile. Please try again.');
      },
    });
  }

  /* ── Helpers ── */
  loadGoogleMaps(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google?.maps) return resolve();
      const el = document.getElementById('gmap-script');
      if (el) { el.addEventListener('load', () => resolve()); return; }
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

  mapStyles() {
    return [
      { elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ];
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  goToPlayers() {
    this.router.navigate(['/players']);
  }
}
