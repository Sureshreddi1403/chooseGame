import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FloatingNavComponent } from './shared/components/floating-nav/floating-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FloatingNavComponent],
  template: `
    <router-outlet />
    <app-floating-nav />
  `,
})
export class AppComponent {}
