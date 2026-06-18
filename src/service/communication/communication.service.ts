import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CommunicationService {
  private http = inject(HttpClient);
  // Inject HttpBackend to create requests that bypass interceptors
  private httpBackend = inject(HttpBackend); 

  // --- EXAM MANAGEMENT APIs ---
  getAllExams(type: string, cursor?: string): Observable<any> {
    let apiUrl = `/api/admin/exam/all?type=${type}`;
    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  getExamById(examId: string): Observable<any> {
    const apiUrl = `/api/admin/exam/${examId}`;
    return this.http.get<any>(apiUrl);
  }

  createExam(examData: any): Observable<any> {
    const apiUrl = '/api/admin/exam/create';
    return this.http.post<any>(apiUrl, examData);
  }

  updateExam(examId: string, examData: any): Observable<any> {
    const apiUrl = `/api/admin/exam/update`;
    return this.http.put<any>(apiUrl, examData);
  }

  deleteExam(examId: string): Observable<any> {
    const apiUrl = `/api/admin/exam/${examId}`;
    return this.http.delete<any>(apiUrl);
  }

  // --- USER MANAGEMENT APIs ---
  getAllUsers(cursor?: string): Observable<any> {
    let apiUrl = `/api/admin/profiles`;
    if (cursor) {
      apiUrl += `?cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  // --- ADMIN PROFILE APIs ---
  getAdminProfile(): Observable<any> {
    return this.http.get<any>('/api/user/profile');
  }

  updateAdminProfile(payload: { name: string; phoneNumber: string }): Observable<any> {
    return this.http.patch<any>('/api/user/profile', payload);
  }

  // --- PDF MANAGEMENT APIs ---
  getAllPdfs(examType: string, cursor?: string): Observable<any> {
    let apiUrl = `/api/user/pdf/${examType}`;
    if (cursor) {
      apiUrl += `?cursor=${encodeURIComponent(cursor)}`;
    }
    return this.http.get<any>(apiUrl);
  }

  deletePdf(pdfId: string): Observable<any> {
    const apiUrl = `/api/admin/pdf/${pdfId}`;
    return this.http.delete<any>(apiUrl);
  }

  // S3 UPLOAD STEP 1: Get Presigned URL
  generatePdfPresignedUrl(payload: { fileName: string, examType: string, contentType: string }): Observable<any> {
    return this.http.post<any>('/api/admin/pdf/generate-url', payload);
  }

  // --- DIAGRAM MANAGEMENT APIs ---
  
  // S3 UPLOAD STEP 1: Get Diagram Presigned URL
  generateDiagramPresignedUrl(fileName: string, examType: string, fileType: string): Observable<any> {
    const apiUrl = `/api/admin/exam/diagram/generate-url?fileName=${fileName}&examType=${examType}`;
    return this.http.post<any>(apiUrl, {}, {
      headers: {
        'X-File-Type': fileType
      }
    });
  }

  // S3 UPLOAD STEP 2: Upload directly to S3 (Bypasses Auth Interceptor)
  // Note: We rename this from uploadPdfToS3 to a generic uploadFileToS3 so both PDF and Images can use it
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
    return this.http.post<any>('/api/admin/pdf/confirm', payload);
  }

  // --- DASHBOARD STATS API ---
  getDashboardStats(): Observable<{ totalUsers: number; totalExams: number; totalPdfs: number }> {
    return this.http.get<any>('/api/admin/dashboard/stats');
  }
}
