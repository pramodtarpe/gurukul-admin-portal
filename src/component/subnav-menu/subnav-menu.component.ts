import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'ga-subnav-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './subnav-menu.component.html',
  styleUrls: ['./subnav-menu.component.scss']
})
export class SubnavMenuComponent {
  collapsed = true;

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }
}
