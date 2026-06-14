import { Component, inject, signal } from '@angular/core';
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
export class AuthPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  activeTab = signal<AuthTab>('signin');
  error_SignIn_Message = signal('');
  showError_SignIn_Message = signal(false);
  registerError = signal('');
  verificationMessage = signal('');
  isSubmitting = signal(false);

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
    },
    { validators: passwordMatchValidator('password_Register', 'confirmPassword_Register') }
  );

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
