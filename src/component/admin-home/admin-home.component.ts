import { Component, OnInit } from '@angular/core';
import { NgFor, CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { StatTileComponent, StatTileData } from '../stat-tile/stat-tile.component';

@Component({
  selector: 'ga-admin-home',
  standalone: true,
  imports: [StatTileComponent, NgFor],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss'
})
export class AdminHomeComponent implements OnInit {
  tiles: StatTileData[] = [];
  loading = true;

  constructor(
    private communicationService: CommunicationService
  ) {}

  ngOnInit(): void {
    this.fetchDashboardStats();
  }

  fetchDashboardStats(): void {
    this.loading = true;

    this.communicationService.getDashboardStats().subscribe({
      next: (response) => {
        this.tiles = [
          {
            title: 'Total Users',
            value: response.totalUsers ?? 0,
            icon: '\uD83D\uDC65', // 👥
            bgColor: '#e0f2fe'
          },
          {
            title: 'Total Exams',
            value: response.totalExams ?? 0,
            icon: '\uD83D\uDCD6', // 📖
            bgColor: '#fef3c7'
          },
          {
            title: 'Total PDFs',
            value: response.totalPdfs ?? 0,
            icon: '\uD83D\uDCC4', // 📄
            bgColor: '#fce7f3'
          }
        ];

        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to fetch dashboard stats:', error);
        this.tiles = [
          { title: 'Total Users', value: 0, icon: '\uD83D\uDC65', bgColor: '#e0f2fe' },
          { title: 'Total Exams', value: 0, icon: '\uD83D\uDCD6', bgColor: '#fef3c7' },
          { title: 'Total PDFs', value: 0, icon: '\uD83D\uDCC4', bgColor: '#fce7f3' }
        ];
        this.loading = false;
      }
    });
  }
}