// app.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common'; // Required for conditional checks
import { HeaderComponent } from '../component/header/header.component';
import { SubnavMenuComponent } from '../component/subnav-menu/subnav-menu.component';
import { MaintenanceBannerComponent } from '../component/maintenance-banner/maintenance-banner.component';
import { NotificationWrapperComponent } from '../component/notification-wrapper/notification-wrapper.component';
import { AuthService } from '../service/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  // Added CommonModule to the imports array
  imports: [RouterOutlet, CommonModule, HeaderComponent, SubnavMenuComponent, MaintenanceBannerComponent, NotificationWrapperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'gurukul-admin-portal';
  
  // Inject the auth service to access the status signal
  authService = inject(AuthService);
}