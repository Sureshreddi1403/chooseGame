import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SignInRequest {
  username_SignIn: string;
  password_SignIn: string;
}

export interface RegisterRequest {
  username_Register: string;
  handedness_Register: 'left' | 'right';
  gender_Register: string;
  email_Register: string;
  password_Register: string;
  confirmPassword_Register: string;
  rating_Register?: number;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: { id?: string } | unknown;
  session?: unknown;
}

export interface EmailCheckResponse {
  exists: boolean;
  email?: string;
  message?: string;
}

export interface OtpSendResponse {
  success: boolean;
  message?: string;
}

export interface OtpVerifyResponse {
  verified: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  get currentUserId(): string | null {
    return localStorage.getItem('pg_user_id');
  }

  set currentUserId(id: string | null) {
    if (id) localStorage.setItem('pg_user_id', id);
    else localStorage.removeItem('pg_user_id');
  }

  signIn(payload: SignInRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/signin`, payload).pipe(
      tap((response) => {
        if (response.user && typeof response.user === 'object' && 'id' in response.user) {
          this.currentUserId = (response.user as { id?: string }).id ?? null;
        }
      })
    );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, payload);
  }

  checkEmail(email: string): Observable<EmailCheckResponse> {
    return this.http.get<EmailCheckResponse>(
      `${this.apiUrl}/auth/check-email`,
      { params: { email } }
    );
  }

  checkUsername(username: string): Observable<EmailCheckResponse> {
    return this.http.get<EmailCheckResponse>(
      `${this.apiUrl}/auth/check-username`,
      { params: { username } }
    );
  }

  forgotPassword(email: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/forgot-password`, {
      email,
    });
  }

  sendOtp(type: 'email' | 'phone', target: string): Observable<OtpSendResponse> {
    return this.http.post<OtpSendResponse>(`${this.apiUrl}/auth/send-otp`, {
      type,
      target,
    });
  }

  verifyOtp(type: 'email' | 'phone', target: string, code: string): Observable<OtpVerifyResponse> {
    return this.http.post<OtpVerifyResponse>(`${this.apiUrl}/auth/verify-otp`, {
      type,
      target,
      code,
    });
  }
}
