import { Component } from '@angular/core';
import { StatTileComponent } from '../stat-tile/stat-tile.component';

@Component({
  selector: 'ga-admin-home',
  standalone: true,
  imports: [ StatTileComponent ],
  templateUrl: './admin-home.component.html',
  styleUrl: './admin-home.component.scss'
})
export class AdminHomeComponent {

}
