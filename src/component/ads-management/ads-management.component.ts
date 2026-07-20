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
        urls.forEach((url, index) => {
          if (index < this.maxImages && this.imageSlots[index]) {
            this.imageSlots[index].imageUrl = url;
            this.imageSlots[index].previewUrl = url;
            this.imageSlots[index].uploaded = true;
          }
        });
        this.isLoadingBanners = false;
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
      // Step 1: Get presigned URL from backend (passes X-File-Type header)
      const fileName = `carousel/images/ADS_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

      console.log('[Ads] Step 1: Generating presigned URL for file:', file.name);
      const presignedResponse = await new Promise<any>((resolve, reject) => {
        this.communicationService.generateCarouselImagePresignedUrl(fileName, file.type).subscribe({
          next: (res) => { resolve(res); console.log('[Ads] Step 1 complete:', res); },
          error: (err) => reject(err)
        });
      });

      const uploadUrl = presignedResponse.uploadUrl;
      const fileUrl = presignedResponse.fileUrl;
      
      if (!uploadUrl) {
        throw new Error('No uploadUrl returned from backend');
      }

      // Step 2: PUT to S3 presigned URL (bypasses auth interceptor via HttpBackend)
      slot.uploading = true;
      console.log('[Ads] Step 2: Uploading to S3, file size:', file.size);
      
      await new Promise<void>((resolve, reject) => {
        this.communicationService.uploadCarouselImageToS3(uploadUrl, file).subscribe({
          next: () => resolve(),
          error: (err) => { console.error('[Ads] Step 2 failed:', err); reject(err); }
        });
      });
      console.log('[Ads] Step 2 complete');

      // Step 3: Register the image URL with backend at specific index (0-4)
      console.log(`[Ads] Step 3: Replacing carousel image at index ${index}`);
      
      await new Promise<void>((resolve, reject) => {
        this.communicationService.replaceCarouselImage(index, fileUrl).subscribe({
          next: () => resolve(),
          error: (err) => { console.error('[Ads] Step 3 failed:', err); reject(err); }
        });
      });
      console.log('[Ads] Step 3 complete');

      // Success — update slot state in Angular zone so change detection fires
      this.ngZone.run(() => {
        slot.file = null;
        slot.previewUrl = null;
        slot.imageUrl = fileUrl;
        slot.uploaded = true;
        slot.uploading = false;
        this.notificationService.showSuccess(`Image uploaded to Slot ${index + 1} successfully!`);
        // Force change detection (some cases async RxJS callbacks don't trigger it)
        this.cdr.markForCheck();
      });
    } catch (error) {
      console.error('[Ads] Error uploading carousel image:', error);
      this.ngZone.run(() => {
        this.notificationService.showError(`Failed to upload "${file.name}". Please try again.`);
        // Reset state on error so user can retry
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
    return !slot.uploading && hasImage;
  }

  // Force a re-render of the entire grid (useful after async operations)
  forceRefresh(): void {
    this.cdr.detectChanges();
  }

  removeImage(index: number): void {
    const slot = this.imageSlots[index];
    
    if (slot.uploading) {
      this.notificationService.showError('Please wait for current upload to finish.');
      return;
    }
    
    // Clean up preview URL before removal
    if (slot.previewUrl && !slot.imageUrl) {
      URL.revokeObjectURL(slot.previewUrl);
    }
    
    // POST /api/admin/carousel/remove/{index}
    this.communicationService.removeCarouselImage(index).subscribe({
      next: () => {
        console.log(`[Ads] Removed carousel image at index ${index}`);
        
        // Reload fresh state from server — images auto-reorder
        this.loadCarouselBanners();
        this.notificationService.showSuccess('Image removed successfully.');
      },
      error: (error) => {
        console.error('[Ads] Failed to remove image:', error);
        this.notificationService.showError('Failed to remove image. Please try again.');
      }
    });
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  ngOnDestroy(): void {
    // Clean up preview URLs
    this.imageSlots.forEach(slot => {
      if (slot.previewUrl && !slot.imageUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
    });
  }
}