// src/component/news-management/news-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../service/notification.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MarkdownPipe } from '../../app/pipes/markdown.pipe';

export interface INewsItem {
  newsId: string;
  title: string;
  content: string;
  imageUrls: string[];
  createdDate: number;
  expiryDate?: number;
  isActive?: boolean;
  linkUrl?: string;
}

export interface IImageUploadState {
  file: File;
  url: string;
  uploading: boolean;
  uploaded: boolean;
  progress: number;
}

@Component({
  selector: 'ga-news-management',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, ConfirmDialogComponent, MarkdownPipe],
  templateUrl: './news-management.component.html',
  styleUrls: ['./news-management.component.scss']
})
export class NewsManagementComponent implements OnInit {
  // Pagination state
  newsData: INewsItem[] = [];
  isLoading: boolean = false;
  currentCursor: string | null = null;
  nextCursor: string | null = null;

  // Limit options for dropdown
  limitOptions: number[] = [5, 10, 25, 50];
  selectedLimit: number = 5;

  // Form fields
  newsTitle: string = '';
  newsContent: string = '';
  previewMarkdown: string = '';
  expiryDate: string = '';

  // Image upload state (max 5 images)
  imageUploadStates: IImageUploadState[] = [];
  maxImages: number = 5;

  // Modal states
  showCreateSuccessModal: boolean = false;
  showConfirmDialog: boolean = false;
  newsToDelete: INewsItem | null = null;

  // View toggle (show form vs show list)
  showCreateForm: boolean = false;

  // Upload state tracking
  isSubmitting: boolean = false;
  isFetchingNews: boolean = false;

  constructor(
    private communicationService: CommunicationService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadAllNews();
  }

  // ===================== VIEW TOGGLE =====================

  onShowCreateForm(): void {
    this.showCreateForm = true;
  }

  onCancelCreate(): void {
    if (this.newsTitle || this.newsContent || this.imageUploadStates.length > 0) {
      const confirmReset = window.confirm(
        'Are you sure you want to cancel? All unsaved changes will be lost.'
      );
      if (confirmReset) {
        this.resetForm();
      }
    }
    this.showCreateForm = false;
  }

  // ===================== NEWS LIST LOADING =====================

  loadAllNews(cursor?: string | null): void {
    this.isFetchingNews = true;
    this.communicationService.getAllPublicNews(this.selectedLimit, cursor || undefined).subscribe({
      next: (response) => {
        this.newsData = response?.items || [];
        this.nextCursor = response?.lastEvaluatedKey || null;
        this.currentCursor = cursor || null;
        this.isFetchingNews = false;
      },
      error: (error) => {
        console.error('Error fetching news:', error);
        this.isFetchingNews = false;
        this.notificationService.showError('Failed to load news. Please try again.');
      }
    });
  }

  onLimitChange(): void {
    this.loadAllNews();
  }

  onNextPage(): void {
    if (this.nextCursor) {
      this.currentCursor = this.nextCursor;
      this.loadAllNews(this.nextCursor);
    }
  }

  onPrevPage(): void {
    if (this.currentCursor) {
      this.loadAllNews(null); // Go back to first page
    }
  }

  canGoNext(): boolean {
    return !!this.nextCursor;
  }

  canGoPrev(): boolean {
    return !!this.currentCursor && this.newsData.length > 0;
  }

  // ===================== IMAGE UPLOAD (max 5) =====================

  onFileSelected(event: any, index: number): void {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (this.imageUploadStates.length >= this.maxImages) break;

      // Check image type
      if (!file.type.startsWith('image/')) continue;

      const maxSize = 5 * 1024 * 1024; // 5MB max per image
      if (file.size > maxSize) {
        this.notificationService.showError(`File "${file.name}" exceeds 5MB limit.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imageUploadStates.push({
          file,
          url: e.target?.result || '',
          uploading: false,
          uploaded: false,
          progress: 0
        });
      };
      reader.readAsDataURL(file);
    }

    // Reset the input so the same file can be selected again
    event.target.value = '';
  }

  async uploadImageToS3(imageState: IImageUploadState): Promise<string | null> {
    try {
      imageState.uploading = true;

      const fileName = `NEWS_${Date.now()}_${Math.random().toString(36).substring(7)}_${imageState.file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const fileType = imageState.file.type; // <-- Extract the exact MIME type (e.g., 'image/png')

      // Step 1: Get presigned URL
      const response = await new Promise<any>((resolve, reject) => {
        // Pass fileType to the service
        this.communicationService.generateNewsImagePresignedUrl(fileName, fileType).subscribe({
          next: resolve,
          error: reject
        });
      });

      // Step 2: Upload to S3 directly (bypasses auth)
      const uploadResponse = await new Promise<any>((resolve, reject) => {
        this.communicationService.uploadNewsImageToS3(response.uploadUrl, imageState.file).subscribe({
          next: resolve,
          error: reject
        });
      });

      return response.fileUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      this.notificationService.showError(`Failed to upload "${imageState.file.name}". Please try again.`);
      return null;
    } finally {
      imageState.uploading = false;
    }
  }

  removeImage(index: number): void {
    if (this.imageUploadStates[index]?.uploading) {
      this.notificationService.showError('Cannot remove image while uploading.');
      return;
    }
    this.imageUploadStates.splice(index, 1);
  }

  // ===================== CREATE NEWS =====================

  insertMd(prefix: string): void {
    const textarea = document.getElementById('news-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.newsContent.substring(start, end);

    let newText: string;
    let newCursorPos: number;

    if (selectedText && !prefix.endsWith(' ')) {
      // Wrap (bold/italic): **text**
      newText = this.newsContent.substring(0, start) + prefix + selectedText + prefix + this.newsContent.substring(end);
      newCursorPos = end + prefix.length * 2;
    } else if (prefix.endsWith(' ')) {
      // Prefix (heading/list): ## or - or 1.
      const lines = this.newsContent.split('\n');
      let lineStart = start;
      for (let i = 0; i < lines.length && lineStart > lines[i].length; i++) {
        lineStart -= lines[i].length + 1; // +1 for newline
      }
      const charIndex = lineStart;
      newText = this.newsContent.substring(0, charIndex) + prefix + this.newsContent.substring(charIndex);
      newCursorPos = charIndex + prefix.length;
    } else {
      // Plain insert (e.g., ~~ for strikethrough)
      newText = this.newsContent.substring(0, start) + prefix + this.newsContent.substring(end);
      newCursorPos = start + prefix.length;
    }

    this.newsContent = newText;
    setTimeout(() => {
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  }

  onTogglePreview(): void {
    this.previewMarkdown = !this.previewMarkdown ? this.newsContent : '';
  }

  async onCreateNews(): Promise<void> {
    if (!this.newsTitle.trim()) {
      this.notificationService.showError('Please enter a news title.');
      return;
    }

    // Validate expiry date
    const now = Math.floor(Date.now() / 1000);
    let expiryEpoch: number;
    if (this.expiryDate) {
      const selectedDate = new Date(this.expiryDate + 'T23:59:59');
      expiryEpoch = Math.floor(selectedDate.getTime() / 1000);
      if (expiryEpoch <= now) {
        this.notificationService.showError('Expiry date must be in the future.');
        return;
      }
    } else {
      // Default to 7 days from now
      expiryEpoch = now + 7 * 24 * 60 * 60;
    }

    // Upload all images first
    this.isSubmitting = true;
    const uploadedImageUrls: string[] = [];

    for (const imageState of this.imageUploadStates) {
      if (imageState.uploaded) continue;

      const url = await this.uploadImageToS3(imageState);
      if (url) {
        uploadedImageUrls.push(url);
        imageState.uploaded = true;
      } else {
        this.notificationService.showError('Image upload failed. Aborting news creation.');
        this.isSubmitting = false;
        return;
      }
    }

    // Prepare payload and create news
    const payload = {
      title: this.newsTitle.trim(),
      content: this.newsContent.trim(),
      imageUrls: uploadedImageUrls,
      expiryDate: expiryEpoch
    };

    try {
      await new Promise<void>((resolve, reject) => {
        this.communicationService.createNews(payload).subscribe({
          next: (response) => resolve(response),
          error: reject
        });
      });

      // Reset form and go back to list view
      this.resetForm();
      this.showCreateForm = false;
      // Reload news list
      this.loadAllNews(null);
      this.notificationService.showSuccess('News published successfully!');
    } catch (error) {
      console.error('Error creating news:', error);
      this.notificationService.showError('Failed to create news. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  resetForm(): void {
    this.newsTitle = '';
    this.newsContent = '';
    this.expiryDate = '';
    this.imageUploadStates = [];
  }

  // ===================== DELETE NEWS =====================

  onDeleteClick(news: INewsItem): void {
    this.newsToDelete = news;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (!this.newsToDelete) return;

    const title = this.newsToDelete.title;
    const id = this.newsToDelete.newsId;
    this.showConfirmDialog = false;

    this.communicationService.deleteNews(id).subscribe({
      next: () => {
        this.notificationService.showSuccess(`Successfully deleted the news: ${title}`);
        this.loadAllNews(null); // Reload from first page
      },
      error: (error) => {
        console.error('Error deleting news:', error);
        this.notificationService.showError(`Failed to delete the news: ${title}. Please try again later.`);
      }
    });

    this.newsToDelete = null;
  }

  onCancelDelete(): void {
    this.showConfirmDialog = false;
    this.newsToDelete = null;
  }

  // ===================== UTILITIES =====================

  formatDate(epochSeconds: number): string {
    return new Date(epochSeconds * 1000).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  isExpired(expiryEpoch: number): boolean {
    return expiryEpoch < Math.floor(Date.now() / 1000);
  }

  truncate(text: string, limit: number = 120): string {
    if (!text) return '';
    // Strip markdown for preview
    const plainText = text.replace(/[#*`\[\]()]/g, '').trim();
    return plainText.length > limit ? plainText.substring(0, limit) + '...' : plainText;
  }

  truncateImageUrl(url: string, limit: number = 80): string {
    if (!url || url.length <= limit) return url;
    const filenameIdx = url.lastIndexOf('/') + 1;
    const fileName = url.substring(filenameIdx);
    if (fileName && fileName.length > 35) {
      return '...' + fileName.slice(-35);
    }
    return url;
  }

  expandedNewsIds: Set<string> = new Set<string>();

  toggleExpand(newsId: string): void {
    if (this.expandedNewsIds.has(newsId)) {
      this.expandedNewsIds.delete(newsId);
    } else {
      this.expandedNewsIds.add(newsId);
    }
  }
  isExpanded(newsId: string): boolean {
    return this.expandedNewsIds.has(newsId);
  }
  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

}