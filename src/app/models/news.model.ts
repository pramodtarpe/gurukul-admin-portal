// src/app/models/news.model.ts

export interface INewsItem {
  newsId: string;
  title: string;
  content: string;
  imageUrls: string[];
  createdDate: number;
  expiryDate: number;
}

export interface INewsListResponse {
  items: INewsItem[];
  lastEvaluatedKey?: string | null;
}

export interface INewsImageUploadResponse {
  uploadUrl: string;
  fileUrl: string;
}

export interface ICreateNewsPayload {
  title: string;
  content: string;
  imageUrls: string[];
  expiryDate: number; // epoch seconds
}