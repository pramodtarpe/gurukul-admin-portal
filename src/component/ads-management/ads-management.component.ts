// src/component/ads-management/ads-management.component.ts
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../service/notification.service';

export interface ICarouselImageSlot {
  index: number;
  imageUrl: string | null;
  file: File | null;
  previewUrl: string | null;
  uploading: boolean;
  uploaded: boolean;
  progress: number;
  removing?: boolean;
}

@Component({
  selector: 'ga-ads-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ads-management.component.html',
  styleUrls: ['./ads-management.component.scss']
})
export class AdsManagementComponent implements OnInit {
  imageSlots: ICarouselImageSlot[] = [];
  maxImages: number = 5;
  isLoadingBanners: boolean = false;

  hasLoadedImages(): boolean {
    return this.imageSlots.some(s => s.imageUrl !== null);
  }

  constructor(
    private communicationService: CommunicationService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initializeSlots();
    this.loadCarouselBanners();
  }

  initializeSlots(): void {
    this.imageSlots = [];
    for (let i = 0; i < this.maxImages; i++) {
      this.imageSlots.push({
        index: i,
        imageUrl: null,
        file: null,
        previewUrl: null,
        uploading: false,
        uploaded: false,
        progress: 0
      });
    }
  }

  loadCarouselBanners(): void {
    this.isLoadingBanners = true;
    this.communicationService.getCarouselBanners().subscribe({
      next: (urls) => {
        // CRITICAL FIX: Loop over all maxImages to guarantee stale data is wiped out
        for (let i = 0; i < this.maxImages; i++) {
          if (i < urls.length) {
            this.imageSlots[i].imageUrl = urls[i];
            this.imageSlots[i].previewUrl = urls[i];
            this.imageSlots[i].uploaded = true;
          } else {
            // Explicitly clear trailing slots!
            this.imageSlots[i].imageUrl = null;
            this.imageSlots[i].previewUrl = null;
            this.imageSlots[i].uploaded = false;
          }
          this.imageSlots[i].removing = false; // Reset removing state
        }
        
        this.isLoadingBanners = false;
        this.cdr.detectChanges(); // Ensure UI reflects the change immediately
      },
      error: (error) => {
        console.error('Error fetching carousel banners:', error);
        this.isLoadingBanners = false;
        this.notificationService.showError('Failed to load carousel images.');
      }
    });
  }

  onFileSelected(event: any, index: number): void {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.notificationService.showError('Please select a valid image file.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB max
    if (file.size > maxSize) {
      this.notificationService.showError(`File "${file.name}" exceeds 5MB limit.`);
      return;
    }

    this._uploadImage(file, index).finally(() => {
      event.target.value = '';
    });
  }

  private async _uploadImage(file: File, index: number): Promise<void> {
    const slot = this.imageSlots[index];
    
    try {
      const fileName = `carousel/images/ADS_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      
      const presignedResponse = await new Promise<any>((resolve, reject) => {
        this.communicationService.generateCarouselImagePresignedUrl(fileName, file.type).subscribe({
          next: (res) => resolve(res),
          error: (err) => reject(err)
        });
      });

      const uploadUrl = presignedResponse.uploadUrl;
      const fileUrl = presignedResponse.fileUrl;
      
      if (!uploadUrl) {
        throw new Error('No uploadUrl returned from backend');
      }

      slot.uploading = true;
      
      await new Promise<void>((resolve, reject) => {
        this.communicationService.uploadCarouselImageToS3(uploadUrl, file).subscribe({
          next: () => resolve(),
          error: (err) => reject(err)
        });
      });

      await new Promise<void>((resolve, reject) => {
        this.communicationService.replaceCarouselImage(index, fileUrl).subscribe({
          next: () => resolve(),
          error: (err) => reject(err)
        });
      });

      this.ngZone.run(() => {
        slot.file = null;
        slot.previewUrl = null;
        slot.imageUrl = fileUrl;
        slot.uploaded = true;
        slot.uploading = false;
        this.notificationService.showSuccess(`Image uploaded to Slot ${index + 1} successfully!`);
        this.cdr.markForCheck();
      });

    } catch (error) {
      console.error('[Ads] Error uploading carousel image:', error);
      this.ngZone.run(() => {
        this.notificationService.showError(`Failed to upload "${file.name}". Please try again.`);
        slot.uploading = false;
        if (!slot.imageUrl) {
          slot.file = null;
          slot.previewUrl = null;
        }
        this.cdr.markForCheck();
      });
    }
  }

  canRemove(slot: ICarouselImageSlot): boolean {
    const hasImage = !!slot.imageUrl || !!slot.previewUrl;
    return !slot.uploading && !slot.removing && hasImage;
  }

  removeImage(index: number): void {
    const slot = this.imageSlots[index];
    
    if (slot.uploading || slot.removing) {
      this.notificationService.showError('Please wait for current operation to finish.');
      return;
    }

    // Set removing state for smooth transition
    slot.removing = true;
    
    if (slot.previewUrl && !slot.imageUrl) {
      URL.revokeObjectURL(slot.previewUrl);
    }
    
    this.communicationService.removeCarouselImage(index).subscribe({
      next: () => {
        // Automatically fetches and correctly parses the array, 
        // shifting the images forward and blanking the empty slots.
        this.loadCarouselBanners();
        this.notificationService.showSuccess('Image removed successfully.');
      },
      error: (error) => {
        console.error('[Ads] Failed to remove image:', error);
        slot.removing = false;
        this.notificationService.showError('Failed to remove image. Please try again.');
      }
    });
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  ngOnDestroy(): void {
    this.imageSlots.forEach(slot => {
      if (slot.previewUrl && !slot.imageUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
    });
  }
}