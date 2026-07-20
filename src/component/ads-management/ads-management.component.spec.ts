import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdsManagementComponent } from './ads-management.component';
import { CommunicationService } from '../../service/communication/communication.service';
import { NotificationService } from '../../service/notification.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('AdsManagementComponent', () => {
  let component: AdsManagementComponent;
  let fixture: ComponentFixture<AdsManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdsManagementComponent, FormsModule, CommonModule]
    }).compileComponents();

    fixture = TestBed.createComponent(AdsManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with 5 empty slots', () => {
    expect(component.imageSlots.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(component.imageSlots[i].index).toBe(i);
      expect(component.imageSlots[i].imageUrl).toBeNull();
      expect(component.imageSlots[i].file).toBeNull();
      expect(component.imageSlots[i].previewUrl).toBeNull();
      expect(component.imageSlots[i].uploading).toBe(false);
      expect(component.imageSlots[i].uploaded).toBe(false);
    }
  });
});
