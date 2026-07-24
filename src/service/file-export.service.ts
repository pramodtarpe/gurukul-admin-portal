import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FileExportService {

  /**
   * Converts a JavaScript object to a JSON string and triggers a browser download.
   * 
   * @param payload The data object to be serialized and downloaded.
   * @param mode Prefix for the filename (kept for backward compatibility, but optional).
   */
  downloadBackupFile(payload: any, mode: string = ''): void {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchorNode = document.createElement('a');
    
    // 1. Extract and sanitize the exam title
    let rawTitle = payload.title || 'Untitled_Exam';
    const safeTitle = rawTitle.replace(/[\/\\?%*:|"<> ]/g, '_').replace(/_+/g, '_');

    // 2. Generate the Timestamp
    const istOptions: Intl.DateTimeFormatOptions = { 
        timeZone: 'Asia/Kolkata', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: true 
    };
    
    // Convert to uppercase first so 'am'/'pm' becomes 'AM'/'PM'
    const istString = new Date().toLocaleString('en-IN', istOptions)
        .toUpperCase()
        .replace(/[\/\\, :]/g, '_') 
        .replace(/_+/g, '_'); 

    // 3. Construct final filename: EXAM_{exam-title}_{Datetime}.json
    const fileName = `EXAM_${safeTitle}_${istString}.json`;
    
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    
    // Required for Firefox compatibility
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
}