import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private http = inject(HttpClient);
  // Inject HttpBackend to create requests that bypass interceptors
  private httpBackend = inject(HttpBackend);

  // --- EXAM MANAGEMENT APIs ---
  getAllExams(type: string, cursor?: string): Observable<any> {
    let apiUrl = `${environment.apiBase}/api/admin/exam/all?type=${type}`;
    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  getExamById(examId: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/exam/${examId}`;
    return this.http.get<any>(apiUrl);
  }

  createExam(examData: any): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/exam/create`;
    return this.http.post<any>(apiUrl, examData);
  }

  updateExam(examId: string, examData: any): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/exam/update`;
    return this.http.put<any>(apiUrl, examData);
  }

  getExamAttempts(examId: string, cursor?: string): Observable<any> {
    let apiUrl = `${environment.apiBase}/api/admin/exam/attempts/${examId}?limit=5`;
    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  getExamAttemptByEmail(examId: string, email: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/exam/attempt/${examId}?email=${encodeURIComponent(email)}`;
    return this.http.get<any>(apiUrl);
  }

  getUserProfileByEmail(email: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/profile?email=${encodeURIComponent(email)}`;
    return this.http.get<any>(apiUrl);
  }

  deleteExam(examId: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/exam/${examId}`;
    return this.http.delete<any>(apiUrl);
  }

  // --- USER MANAGEMENT APIs ---
  getAllUsers(cursor?: string): Observable<any> {
    let apiUrl = `${environment.apiBase}/api/admin/profiles`;
    if (cursor) {
      apiUrl += `?cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  // --- ADMIN PROFILE APIs ---
  getAdminProfile(): Observable<any> {
    return this.http.get<any>(`${environment.apiBase}/api/user/profile`);
  }

  updateAdminProfile(payload: { name: string; phoneNumber: string }): Observable<any> {
    return this.http.patch<any>(`${environment.apiBase}/api/user/profile`, payload);
  }

  // --- PDF MANAGEMENT APIs ---
  getAllPdfs(examType: string, cursor?: string): Observable<any> {
    let apiUrl = `${environment.apiBase}/api/admin/pdf/${examType}`;
    if (cursor) {
      apiUrl += `?cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  deletePdf(pdfId: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/pdf/${pdfId}`;
    return this.http.delete<any>(apiUrl);
  }

  // S3 UPLOAD STEP 1: Get Presigned URL
  generatePdfPresignedUrl(payload: { fileName: string, examType: string, contentType: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiBase}/api/admin/pdf/generate-url`, payload);
  }

  // --- DIAGRAM MANAGEMENT APIs ---

  // S3 UPLOAD STEP 1: Get Diagram Presigned URL
  generateDiagramPresignedUrl(fileName: string, examType: string, fileType: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/exam/diagram/generate-url?fileName=${fileName}&examType=${examType}`;
    return this.http.post<any>(apiUrl, {}, {
      headers: {
        'X-File-Type': fileType
      }
    });
  }

  // S3 UPLOAD STEP 2: Upload directly to S3 (Bypasses Auth Interceptor)
  uploadFileToS3(uploadUrl: string, file: File): Observable<any> {
    const bypassHttp = new HttpClient(this.httpBackend);
    return bypassHttp.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type
      }
    });
  }

  // S3 UPLOAD STEP 3: Confirm the Upload
  confirmPdfUpload(payload: { title: string, examType: string, fileKey: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiBase}/api/admin/pdf/confirm`, payload);
  }

  // --- MAINTENANCE MODE APIs ---
  toggleMaintenance(enable: boolean): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/system/maintenance?enable=${enable}`;
    return this.http.post<any>(apiUrl, {});
  }

  getMaintenanceStatus(): Observable<{ maintenanceMode: boolean }> {
    return this.http.get<any>(`${environment.apiBase}/api/public/config/status`);
  }

  // --- DASHBOARD STATS API ---
  getDashboardStats(): Observable<{ totalUsers: number; totalExams: number; totalPdfs: number }> {
    return this.http.get<any>(`${environment.apiBase}/api/admin/dashboard/stats`);
  }

  // --- NEWS MANAGEMENT APIs ---

  // Generate presigned URL for news image upload to S3
  generateNewsImagePresignedUrl(fileName: string, fileType: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/news/image-url?fileName=${encodeURIComponent(fileName)}`;
    return this.http.post<any>(apiUrl, {}, {
      headers: {
        'X-File-Type': fileType // <-- ADDED THIS HEADER
      }
    });
  }

  // Upload file directly to S3 (bypasses Auth Interceptor)
  uploadNewsImageToS3(uploadUrl: string, file: File): Observable<any> {
    const bypassHttp = new HttpClient(this.httpBackend);
    return bypassHttp.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type // S3 Content-Type will now match X-File-Type perfectly
      },
      responseType: 'text' // <-- PREVENTS ANGULAR JSON PARSE ERROR ON S3 SUCCESS
    });
  }

  // Create a new news item
  createNews(payload: any): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/news`;
    return this.http.post<any>(apiUrl, payload);
  }

  // Fetch all public news with pagination (cursor-based)
  getAllPublicNews(limit: number, cursor?: string): Observable<any> {
    let apiUrl = `${environment.apiBase}/api/public/news?limit=${limit}`;
    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  // Delete a news item
  deleteNews(newsId: string): Observable<any> {
    const apiUrl = `${environment.apiBase}/api/admin/news/${newsId}`;
    return this.http.delete<any>(apiUrl);
  }
}