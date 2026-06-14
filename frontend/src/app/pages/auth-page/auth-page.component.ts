import { Component, inject, signal, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import {
  emailValidator,
  passwordMatchValidator,
  passwordPolicyValidator,
} from '../../core/validators/auth.validators';

type AuthTab = 'signin' | 'register';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
})
export class AuthPageComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  activeTab = signal<AuthTab>('signin');
  error_SignIn_Message = signal('');
  showError_SignIn_Message = signal(false);
  registerError = signal('');
  verificationMessage = signal('');
  isSubmitting = signal(false);

  /* ── Phone OTP state ── */
  sendingPhoneOtp = signal(false);
  phoneOtpSent = signal(false);
  verifyingPhone = signal(false);
  phoneCountdown = signal(0);
  private phoneTimer: ReturnType<typeof setInterval> | null = null;

  /* ── Email OTP state ── */
  sendingEmailOtp = signal(false);
  emailOtpSent = signal(false);
  verifyingEmail = signal(false);
  emailCountdown = signal(0);
  private emailTimer: ReturnType<typeof setInterval> | null = null;

  signInForm = this.fb.group({
    username_SignIn: ['', [Validators.required]],
    password_SignIn: ['', [Validators.required]],
  });

  registerForm = this.fb.group(
    {
      username_Register: ['', [Validators.required]],
      email_Register: ['', [Validators.required, emailValidator()]],
      gender_Register: ['', [Validators.required]],
      handedness_Register: ['', [Validators.required]],
      password_Register: ['', [Validators.required, passwordPolicyValidator()]],
      confirmPassword_Register: ['', [Validators.required]],
      phoneNumber_Register: [''],
      phoneVerificationCode_Register: [''],
      phoneVerified_Register: [false],
      emailVerificationCode_Register: [''],
      emailVerified_Register: [false],
    },
    { validators: passwordMatchValidator('password_Register', 'confirmPassword_Register') }
  );

  ngOnDestroy(): void {
    this.clearPhoneTimer();
    this.clearEmailTimer();
  }

  setTab(tab: AuthTab): void {
    this.activeTab.set(tab);
    this.showError_SignIn_Message.set(false);
    this.registerError.set('');
    this.verificationMessage.set('');
  }

  onForgotPassword(): void {
    const email = this.signInForm.get('username_SignIn')?.value;
    if (!email) {
      this.error_SignIn_Message.set('Enter your username or email first.');
      this.showError_SignIn_Message.set(true);
      return;
    }

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.error_SignIn_Message.set('Password reset email sent. Check your inbox.');
        this.showError_SignIn_Message.set(true);
      },
      error: () => {
        this.error_SignIn_Message.set('Could not send reset email. Try again.');
        this.showError_SignIn_Message.set(true);
      },
    });
  }

  onLetsPlay_Submit(): void {
    this.showError_SignIn_Message.set(false);

    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const { username_SignIn, password_SignIn } = this.signInForm.getRawValue();

    this.authService
      .signIn({ username_SignIn: username_SignIn!, password_SignIn: password_SignIn! })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.router.navigate(['/home']);
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.error_SignIn_Message.set(
            err.error?.message ?? 'Invalid username or password.'
          );
          this.showError_SignIn_Message.set(true);
        },
      });
  }

  /* ── Phone OTP ── */

  sendPhoneVerificationCode(): void {
    const phone = this.registerForm.get('phoneNumber_Register')?.value?.trim();
    if (!phone) {
      this.registerError.set('Enter a phone number before requesting verification.');
      return;
    }

    this.registerError.set('');
    this.verificationMessage.set('');
    this.sendingPhoneOtp.set(true);

    this.authService.sendOtp('phone', phone).subscribe({
      next: (res) => {
        this.sendingPhoneOtp.set(false);
        this.phoneOtpSent.set(true);
        this.verificationMessage.set(res.message ?? 'Verification code sent to your phone. Check the backend console.');
        this.startPhoneCountdown();
      },
      error: (err) => {
        this.sendingPhoneOtp.set(false);
        this.registerError.set(err.error?.message ?? 'Failed to send verification code.');
      },
    });
  }

  confirmPhoneVerification(): void {
    const phone = this.registerForm.get('phoneNumber_Register')?.value?.trim();
    const code = this.registerForm.get('phoneVerificationCode_Register')?.value?.trim();

    if (!code) {
      this.registerError.set('Please enter the verification code.');
      return;
    }

    this.registerError.set('');
    this.verificationMessage.set('');
    this.verifyingPhone.set(true);

    this.authService.verifyOtp('phone', phone!, code).subscribe({
      next: (res) => {
        this.verifyingPhone.set(false);
        if (res.verified) {
          this.registerForm.get('phoneVerified_Register')?.setValue(true);
          this.verificationMessage.set(res.message ?? 'Phone number verified successfully.');
          this.clearPhoneTimer();
        } else {
          this.registerError.set(res.message ?? 'Incorrect verification code.');
        }
      },
      error: (err) => {
        this.verifyingPhone.set(false);
        this.registerError.set(err.error?.message ?? 'Incorrect verification code.');
      },
    });
  }

  /* ── Email OTP ── */

  sendEmailVerificationCode(): void {
    const email = this.registerForm.get('email_Register')?.value?.trim();
    if (!email || !this.registerForm.get('email_Register')?.valid) {
      this.registerError.set('Enter a valid email before requesting verification.');
      return;
    }

    this.registerError.set('');
    this.verificationMessage.set('');
    this.sendingEmailOtp.set(true);

    this.authService.sendOtp('email', email).subscribe({
      next: (res) => {
        this.sendingEmailOtp.set(false);
        this.emailOtpSent.set(true);
        this.verificationMessage.set(res.message ?? 'Verification code sent to your email. Check the backend console.');
        this.startEmailCountdown();
      },
      error: (err) => {
        this.sendingEmailOtp.set(false);
        this.registerError.set(err.error?.message ?? 'Failed to send verification code.');
      },
    });
  }

  confirmEmailVerification(): void {
    const email = this.registerForm.get('email_Register')?.value?.trim();
    const code = this.registerForm.get('emailVerificationCode_Register')?.value?.trim();

    if (!code) {
      this.registerError.set('Please enter the verification code.');
      return;
    }

    this.registerError.set('');
    this.verificationMessage.set('');
    this.verifyingEmail.set(true);

    this.authService.verifyOtp('email', email!, code).subscribe({
      next: (res) => {
        this.verifyingEmail.set(false);
        if (res.verified) {
          this.registerForm.get('emailVerified_Register')?.setValue(true);
          this.verificationMessage.set(res.message ?? 'Email verified successfully.');
          this.clearEmailTimer();
        } else {
          this.registerError.set(res.message ?? 'Incorrect verification code.');
        }
      },
      error: (err) => {
        this.verifyingEmail.set(false);
        this.registerError.set(err.error?.message ?? 'Incorrect verification code.');
      },
    });
  }

  /* ── Countdown helpers ── */

  private startPhoneCountdown(): void {
    this.clearPhoneTimer();
    this.phoneCountdown.set(60);
    this.phoneTimer = setInterval(() => {
      const v = this.phoneCountdown() - 1;
      this.phoneCountdown.set(v);
      if (v <= 0) this.clearPhoneTimer();
    }, 1000);
  }

  private clearPhoneTimer(): void {
    if (this.phoneTimer) {
      clearInterval(this.phoneTimer);
      this.phoneTimer = null;
    }
    this.phoneCountdown.set(0);
  }

  private startEmailCountdown(): void {
    this.clearEmailTimer();
    this.emailCountdown.set(60);
    this.emailTimer = setInterval(() => {
      const v = this.emailCountdown() - 1;
      this.emailCountdown.set(v);
      if (v <= 0) this.clearEmailTimer();
    }, 1000);
  }

  private clearEmailTimer(): void {
    if (this.emailTimer) {
      clearInterval(this.emailTimer);
      this.emailTimer = null;
    }
    this.emailCountdown.set(0);
  }

  /* ── Registration submit ── */

  onCreateAccount_Submit(): void {
    this.registerError.set('');
    this.verificationMessage.set('');

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const form = this.registerForm.getRawValue();
    this.isSubmitting.set(true);

    this.authService.checkUsername(form.username_Register!).subscribe({
      next: (usernameCheck) => {
        if (usernameCheck.exists) {
          this.isSubmitting.set(false);
          this.registerError.set('Username is already taken.');
          return;
        }

        this.authService.checkEmail(form.email_Register!).subscribe({
          next: (check) => {
            if (check.exists) {
              this.isSubmitting.set(false);
              this.registerError.set('An account with this email already exists.');
              return;
            }

            this.authService
              .register({
                username_Register: form.username_Register!,
                handedness_Register: form.handedness_Register! as 'left' | 'right',
                gender_Register: form.gender_Register!,
                email_Register: form.email_Register!,
                password_Register: form.password_Register!,
                confirmPassword_Register: form.confirmPassword_Register!,
                phoneNumber_Register: form.phoneNumber_Register!,
              })
              .subscribe({
                next: () => {
                  this.isSubmitting.set(false);
                  this.setTab('signin');
                  this.error_SignIn_Message.set('Account created! Please sign in.');
                  this.showError_SignIn_Message.set(true);
                },
                error: (err) => {
                  this.isSubmitting.set(false);
                  this.registerError.set(
                    err.error?.message ?? 'Registration failed. Please try again.'
                  );
                },
              });
          },
          error: () => {
            this.isSubmitting.set(false);
            this.registerError.set('Could not verify email. Please try again.');
          },
        });
      },
      error: () => {
        this.isSubmitting.set(false);
        this.registerError.set('Could not verify username. Please try again.');
      },
    });
  }

  fieldError(form: 'signin' | 'register', field: string): string {
    const ctrl =
      form === 'signin'
        ? this.signInForm.get(field)
        : this.registerForm.get(field);

    if (!ctrl?.touched || !ctrl.errors) return '';

    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['email']) return 'Enter a valid email address.';
    if (ctrl.errors['passwordPolicy'])
      return 'Min 10 chars with uppercase, lowercase, number, and special character.';
    if (ctrl.errors['pattern']) return 'Invalid format.';

    return '';
  }

  passwordMismatch(): boolean {
    return (
      this.registerForm.touched &&
      !!this.registerForm.errors?.['passwordMismatch']
    );
  }
}
