import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VenueService, Venue } from '../../core/services/venue.service';
import { PlayRequestService, PlayRequest } from '../../core/services/play-request.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface ChatMessage {
  author: string;
  text: string;
  time: string;
}

interface ChatThread {
  id: string;
  title: string;
  status: 'pending' | 'matched';
  messages: ChatMessage[];
}

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class HomePageComponent implements OnInit {
  private venueService = inject(VenueService);
  private playRequestService = inject(PlayRequestService);
  private authService = inject(AuthService);

  venues: Venue[] = [];
  nearby: Venue[] = [];
  filteredVenues: Venue[] = [];
  selectedVenue: Venue | null = null;
  selectedGame = '';
  bookingMessage = '';
  bookingError = '';

  chatThreads: ChatThread[] = [];
  selectedChat: ChatThread | null = null;
  newChatMessage = '';

  loading = false;
  locationError = '';
  locationLoading = false;
  searchQuery = '';
  environmentKey = !!environment.googleMapsApiKey;

  playRequestMessage = '';
  playRequestError = '';
  isSubmittingRequest = false;
  availableSports = [
    { label: 'Basketball', value: 'basketball' },
    { label: 'Pickleball', value: 'pickleball' },
    { label: 'Soccer', value: 'soccer' },
    { label: 'Tennis', value: 'tennis' },
    { label: 'Volleyball', value: 'volleyball' },
  ];
  playRequest: PlayRequest = {
    sport_name: 'basketball',
    requested_date: '',
    requested_time: '',
    radius_km: 10,
  };

  async ngOnInit() {
    this.loading = true;
    try {
      const v = await this.venueService.list();
      this.venues = v.map((venue) => ({
        ...venue,
        games_available: venue.games_available ?? ['Basketball', 'Tennis', 'Soccer', 'Volleyball'],
      }));
      this.filteredVenues = [...this.venues];
      await this.loadNearbyCourts();
      await this.initMap();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  async loadNearbyCourts() {
    if (!navigator.geolocation) {
      this.locationError = 'Geolocation is not supported by your browser.';
      return;
    }

    this.locationLoading = true;
    this.locationError = '';

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );

      const { latitude, longitude } = pos.coords;
      this._userLat = latitude;
      this._userLng = longitude;

      this.nearby = this.venues
        .map((venue) => {
          if (!venue.latitude || !venue.longitude) return null;
          const distance = this.distanceKm(latitude, longitude, +venue.latitude, +venue.longitude);
          return { ...venue, distance } as Venue & { distance: number };
        })
        .filter((venue): venue is Venue & { distance: number } => !!venue && venue.distance <= 10)
        .sort((a, b) => a.distance - b.distance);

      this.applySearch();
      await this.initMap();
    } catch (error: any) {
      this.locationError =
        error?.message || 'Unable to determine your location. Please allow location access.';
    } finally {
      this.locationLoading = false;
    }
  }

  applySearch() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredVenues = [...this.venues];
      return;
    }

    this.filteredVenues = this.venues.filter((venue) => {
      return (
        venue.name?.toLowerCase().includes(query) ||
        venue.city?.toLowerCase().includes(query) ||
        venue.state?.toLowerCase().includes(query)
      );
    });
  }

  resetSearch() {
    this.searchQuery = '';
    this.filteredVenues = [...this.venues];
    this.selectedVenue = null;
    this.bookingMessage = '';
    this.bookingError = '';
  }

  selectVenue(venue: Venue) {
    this.selectedVenue = venue;
    this.selectedGame = venue.games_available?.[0] ?? this.availableSports[0].value;
    this.bookingMessage = '';
    this.bookingError = '';
  }

  bookVenue() {
    if (!this.selectedVenue) {
      this.bookingError = 'Select a venue before booking a game.';
      return;
    }
    if (!this.selectedGame) {
      this.bookingError = 'Select a sport to book at this venue.';
      return;
    }

    this.bookingError = '';
    this.bookingMessage = `Booked ${this.selectedGame} at ${this.selectedVenue.name}. Invite nearby players and start chatting once confirmed.`;

    if (this.chatThreads.length === 0) {
      this.chatThreads.push({
        id: `match-${Date.now()}`,
        title: `${this.selectedGame} match at ${this.selectedVenue.name}`,
        status: 'pending',
        messages: [
          { author: 'System', text: 'Waiting for nearby players to accept your request.', time: new Date().toLocaleTimeString() },
        ],
      });
    }
  }

  openChat(thread: ChatThread) {
    this.selectedChat = thread;
    this.newChatMessage = '';
  }

  sendChatMessage() {
    if (!this.selectedChat || !this.newChatMessage.trim()) return;

    this.selectedChat.messages.push({
      author: 'You',
      text: this.newChatMessage.trim(),
      time: new Date().toLocaleTimeString(),
    });
    this.newChatMessage = '';
  }

  acceptMatch(thread: ChatThread) {
    thread.status = 'matched';
    thread.messages.push({
      author: 'System',
      text: 'Your game request has been accepted. Use the chat below to coordinate.',
      time: new Date().toLocaleTimeString(),
    });
    this.selectedChat = thread;
  }

  private _map: any = null;
  private _userLat?: number;
  private _userLng?: number;

  async initMap() {
    if (!environment.googleMapsApiKey) return;
    try {
      await this.loadGoogleMaps(environment.googleMapsApiKey);
      const mapEl = document.getElementById('map');
      if (!mapEl) return;

      const center = { lat: this._userLat ?? 37.7749, lng: this._userLng ?? -122.4194 };
      this._map = new (window as any).google.maps.Map(mapEl, {
        center,
        zoom: 12,
      });

      if (this._userLat && this._userLng) {
        new (window as any).google.maps.Circle({
          strokeColor: '#2563eb',
          strokeOpacity: 0.65,
          strokeWeight: 2,
          fillColor: '#2563eb',
          fillOpacity: 0.12,
          map: this._map,
          center: { lat: this._userLat, lng: this._userLng },
          radius: 10000,
        });
      }

      this.venues.forEach((v) => {
        if (!v.latitude || !v.longitude) return;
        new (window as any).google.maps.Marker({
          position: { lat: +v.latitude, lng: +v.longitude },
          map: this._map,
          title: v.name,
        });
      });
    } catch (e) {
      console.warn('Google Maps failed to load', e);
    }
  }

  loadGoogleMaps(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google && (window as any).google.maps) return resolve();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
      script.defer = true;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  submitPlayRequest() {
    this.playRequestError = '';
    this.playRequestMessage = '';

    if (!this.playRequest.requested_date || !this.playRequest.requested_time) {
      this.playRequestError = 'Please select a date and time.';
      return;
    }

    if (!this.authService.currentUserId) {
      this.playRequestError = 'Please sign in before submitting a play request.';
      return;
    }

    this.isSubmittingRequest = true;

    this.playRequestService
      .create({
        profile_id: this.authService.currentUserId,
        sport_name: this.playRequest.sport_name,
        requested_date: this.playRequest.requested_date,
        requested_time: this.playRequest.requested_time,
        latitude: this._userLat ?? null,
        longitude: this._userLng ?? null,
        radius_km: this.playRequest.radius_km,
      })
      .subscribe({
        next: () => {
          this.isSubmittingRequest = false;
          this.playRequestMessage = 'Your play request has been submitted. Nearby players will be notified within 10 km.';
        },
        error: (err) => {
          this.isSubmittingRequest = false;
          this.playRequestError = err.error?.message || 'Unable to submit your request. Try again later.';
        },
      });
  }

  distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }
}
