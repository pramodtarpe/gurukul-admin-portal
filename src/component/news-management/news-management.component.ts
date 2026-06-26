// src/component/news-management/news-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../service/notification.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MarkdownComponent } from 'ngx-markdown';

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
  imports: [FormsModule, ReactiveFormsModule, CommonModule, ConfirmDialogComponent, MarkdownComponent],
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
  previewMarkdown: boolean = false; // Changed to boolean for cleaner toggle logic
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
    } else {
      this.showCreateForm = false;
    }
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

  // ===================== IMAGE UPLOAD =====================

  onFileSelected(event: any, index: number): void {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (this.imageUploadStates.length >= this.maxImages) break;

      if (!file.type.startsWith('image/')) continue;

      const maxSize = 5 * 1024 * 1024; // 5MB max
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
    event.target.value = '';
  }

  async uploadImageToS3(imageState: IImageUploadState): Promise<string | null> {
    try {
      imageState.uploading = true;
      const fileName = `NEWS_${Date.now()}_${Math.random().toString(36).substring(7)}_${imageState.file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const fileType = imageState.file.type;

      const response = await new Promise<any>((resolve, reject) => {
        this.communicationService.generateNewsImagePresignedUrl(fileName, fileType).subscribe({
          next: resolve,
          error: reject
        });
      });

      await new Promise<any>((resolve, reject) => {
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

  // ===================== CREATE NEWS EDITOR =====================

  insertMd(prefix: string): void {
    const textarea = document.getElementById('news-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = this.newsContent.substring(start, end);

    let newText: string;
    let newCursorPos: number;

    if (selectedText && !prefix.endsWith(' ')) {
      // 1. Wrap selected text (e.g., Bold, Italic: **text**)
      newText = this.newsContent.substring(0, start) + prefix + selectedText + prefix + this.newsContent.substring(end);
      newCursorPos = end + prefix.length * 2;

    } else if (prefix.endsWith(' ')) {
      // 2. Prefix text (e.g., Headings, Lists) -> Insert at the start of the CURRENT line
      // Find the absolute index of the last newline character before the cursor
      const startOfLineIndex = this.newsContent.substring(0, start).lastIndexOf('\n') + 1;

      newText = this.newsContent.substring(0, startOfLineIndex) + prefix + this.newsContent.substring(startOfLineIndex);

      // Move cursor forward to account for the newly inserted characters
      newCursorPos = start + prefix.length;

    } else {
      // 3. Plain inline insert (exactly at cursor position)
      newText = this.newsContent.substring(0, start) + prefix + this.newsContent.substring(end);
      newCursorPos = start + prefix.length;
    }

    this.newsContent = newText;

    // Ensure Angular updates the DOM before we move the selection cursor
    setTimeout(() => {
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  }

  insertLink(): void {
    const textarea = document.getElementById('news-content') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    // Use the highlighted text as the link text, or a default placeholder if nothing is highlighted
    const selectedText = this.newsContent.substring(start, end) || 'link text';
    // Prompt the user for the URL
    const url = window.prompt('Enter the URL for the link:', 'https://');
    // If the user cancels the prompt or leaves it blank, abort insertion
    if (!url) return;
    const markdownLink = `[${selectedText}](${url})`;
    const newText = this.newsContent.substring(0, start) + markdownLink + this.newsContent.substring(end);
    this.newsContent = newText;
    // Move the cursor right after the newly inserted link
    const newCursorPos = start + markdownLink.length;
    setTimeout(() => {
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  }

  onTogglePreview(): void {
    this.previewMarkdown = !this.previewMarkdown;
  }

  async onCreateNews(): Promise<void> {
    if (!this.newsTitle.trim()) {
      this.notificationService.showError('Please enter a news title.');
      return;
    }

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
      expiryEpoch = now + 7 * 24 * 60 * 60;
    }

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

      this.resetForm();
      this.showCreateForm = false;
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
    this.previewMarkdown = false;
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
        this.loadAllNews(null);
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