// app.routes.ts
import { Routes } from '@angular/router';
import { AdminHomeComponent } from '../component/admin-home/admin-home.component';
import { UserManagementComponent } from '../component/user-management/user-management.component';
import { FileManagementComponent } from '../component/file-management/file-management.component';
import { ExamManagementComponent } from '../component/exam-management/exam-management.component';
import { EditExamComponent } from '../component/edit-exam/edit-exam.component';
import { CreateExamComponent } from '../component/create-exam/create-exam.component';
import { AuthComponent } from '../component/auth/auth.component';
import { authGuard } from '../service/auth/auth.guard'; // Import your route guard
import { UploadFileComponent } from '../component/upload-file/upload-file.component';
import { MaintenanceStatusComponent } from '../component/maintenance-status/maintenance-status.component';
import { NewsManagementComponent } from '../component/news-management/news-management.component';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthComponent
  },
  {
    path: '',
    component: AdminHomeComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'users',
    component: UserManagementComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'file',
    component: FileManagementComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'upload-file',
    component: UploadFileComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'exam',
    component: ExamManagementComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'create-exam',
    component: CreateExamComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'edit-exam/:id',
    component: EditExamComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'news',
    component: NewsManagementComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: 'maintenance',
    component: MaintenanceStatusComponent,
    canActivate: [authGuard] // Secure route
  },
  {
    path: '**',
    redirectTo: '' // Fallback wildcard catch-all
  }
];