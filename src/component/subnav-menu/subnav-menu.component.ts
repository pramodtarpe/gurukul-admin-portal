import { Component, Renderer2, Inject } from '@angular/core';
import { DOCUMENT, CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'ga-subnav-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './subnav-menu.component.html',
  styleUrls: ['./subnav-menu.component.scss']
})
export class SubnavMenuComponent {
  collapsed = false;

  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    const sidebarWidth = this.collapsed ? '72px' : '260px';
    this.document.documentElement.style.setProperty('--sidebar-width', sidebarWidth);
  }
}