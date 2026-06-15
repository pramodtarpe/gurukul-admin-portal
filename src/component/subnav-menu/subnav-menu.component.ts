import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ga-subnav-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './subnav-menu.component.html',
  styleUrls: ['./subnav-menu.component.scss']
})
export class SubnavMenuComponent {
  // Session logic has been successfully migrated to the Header Component
}