import { Component, Input } from '@angular/core';

export interface StatTileData {
  title: string;
  value: number | string;
  icon: string;
  bgColor: string;
  textColor?: string;
  trend?: {
    value: string;
    label: string;
    type: 'up' | 'down' | 'neutral';
  };
}

@Component({
  selector: 'ga-stat-tile',
  standalone: true,
  imports: [],
  templateUrl: './stat-tile.component.html',
  styleUrl: './stat-tile.component.scss'
})
export class StatTileComponent {
  @Input() data!: StatTileData;
  @Input() isLoading = false;

  formatNumber(value: number | string | undefined | null): string {
    if (!value && value !== 0) return '0';

    const num = typeof value === 'string' ? parseFloat(value) : value;

    // Format large numbers with commas
    return new Intl.NumberFormat('en-IN').format(num);
  }

  getTrendClass(): string {
    const type = this.data.trend?.type || 'neutral';
    return `trend-${type}`;
  }
}