import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CommunicationService } from '../../service/communication/communication.service';
import { switchMap } from 'rxjs';
import { MathRenderComponent } from '../math-render/math-render.component';

import 'mathlive';

@Component({
  selector: 'ga-create-exam',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule, MathRenderComponent],
  providers: [CommunicationService],
  templateUrl: './create-exam.component.html',
  styleUrl: './create-exam.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CreateExamComponent implements OnInit {
  examForm!: FormGroup;
  examTypes: string[] = ['FREE', 'FOREST_BHARTI', 'POLICE_BHARTI'];
  isSubmitting: boolean = false;

  // --- Workspace Split Panel Tracking State Hooks ---
  activeSectionIndex: number = 0;
  activeQuestionIndex: number = 0;

  // --- Diagram Upload State ---
  isUploadingDiagram: boolean = false;
  uploadingQuestionCoords: { s: number, q: number } | null = null;

  constructor(
    private fb: FormBuilder,
    private communicationService: CommunicationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    this.examForm = this.fb.group({
      title: ['', Validators.required],
      totalQuestions: [null, [Validators.required, Validators.min(1)]],
      totalMarks: [null, [Validators.required, Validators.min(1)]],
      timeLimitMinutes: [null, [Validators.required, Validators.min(1)]],
      examType: 'FREE',
      sections: this.fb.array([])
    }, {
      validators: this.validateTotalQuestions
    });
  }

  get sections() {
    return this.examForm.get('sections') as FormArray;
  }

  getQuestions(sectionIndex: number) {
    return this.sections.at(sectionIndex).get('questions') as FormArray;
  }

  getOptions(sectionIndex: number, questionIndex: number) {
    return this.getQuestions(sectionIndex).at(questionIndex).get('options') as FormArray;
  }

  getCorrectAnswerControl(sectionIndex: number, questionIndex: number): any {
    return this.getQuestions(sectionIndex).at(questionIndex).get('correctAnswersIndex');
  }

  get isExamDetailsValid(): boolean {
    return !!(
      this.examForm.get('title')?.valid &&
      this.examForm.get('totalQuestions')?.valid &&
      this.examForm.get('totalMarks')?.valid &&
      this.examForm.get('timeLimitMinutes')?.valid &&
      this.examForm.get('examType')?.valid
    );
  }

  // --- Master Detail Navigation Helpers ---
  setActiveQuestion(sectionIndex: number, questionIndex: number): void {
    this.activeSectionIndex = sectionIndex;
    this.activeQuestionIndex = questionIndex;
  }

  isQuestionInvalid(sectionIndex: number, questionIndex: number): boolean {
    const questionGroup = this.getQuestions(sectionIndex).at(questionIndex);
    return questionGroup ? questionGroup.invalid && questionGroup.touched : false;
  }

  validateTotalQuestions(control: AbstractControl): ValidationErrors | null {
    const totalQuestions = control.get('totalQuestions')?.value || 0;
    const sectionsArray = control.get('sections') as FormArray;

    if (!sectionsArray) return null;

    let accumulatedQuestions = 0;
    sectionsArray.controls.forEach((section) => {
      const sectionValue = section.get('sectionTotalQuestions')?.value || 0;
      accumulatedQuestions += sectionValue;
    });

    if (accumulatedQuestions > totalQuestions) {
      return { questionLimitExceeded: true };
    }

    return null;
  }

  get currentAllocatedQuestions(): number {
    if (!this.sections) return 0;
    return this.sections.controls.reduce((sum, section) => sum + (section.get('sectionTotalQuestions')?.value || 0), 0);
  }

  addSection() {
    const sectionGroup = this.fb.group({
      sectionTitle: ['', Validators.required],
      sectionTotalQuestions: [null, [Validators.required, Validators.min(1)]],
      sectionTotalMarks: [null, [Validators.required, Validators.min(1)]],
      questions: this.fb.array([])
    });

    this.sections.push(sectionGroup);
    
    const newSectionIdx = this.sections.length - 1;
    this.addQuestion(newSectionIdx);

    // Auto focus the workspace directly to the newly spawned question block
    this.setActiveQuestion(newSectionIdx, 0);
  }

  addQuestion(sectionIndex: number) {
    const questionGroup = this.fb.group({
      text: ['', Validators.required],
      diagramUrl: [null],
      
      // FIX: Changed initial value from 0 to null
      correctAnswersIndex: [null, [Validators.required, Validators.min(0), Validators.max(3)]], 
      
      options: this.fb.array([
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required)
      ])
    });

    const targetQuestionArray = this.getQuestions(sectionIndex);
    targetQuestionArray.push(questionGroup);

    // Automatically navigate focus to the newest added item
    this.setActiveQuestion(sectionIndex, targetQuestionArray.length - 1);
  }

  removeSection(sectionIndex: number) {
    if (confirm(`Are you sure you want to delete Section ${sectionIndex + 1}?`)) {
      this.sections.removeAt(sectionIndex);
      this.examForm.updateValueAndValidity();
      
      // Reset view coordinates safely back to home base position zero
      this.setActiveQuestion(0, 0);
    }
  }

  removeQuestion(sectionIndex: number, questionIndex: number) {
    const questions = this.getQuestions(sectionIndex);
    if (questions.length <= 1) {
      alert("Each section must contain at least one question row.");
      return;
    }

    questions.removeAt(questionIndex);
    
    // Safety check to ensure tracking pointer coordinates don't fall off array boundaries
    const newFocusIndex = questionIndex > 0 ? questionIndex - 1 : 0;
    this.setActiveQuestion(sectionIndex, newFocusIndex);
  }

  onSubmit() {
    if (this.examForm.valid) {
      this.isSubmitting = true;
      const rawFormValue = this.examForm.value; // <--- ADD THIS LINE HERE!

      const finalPayload = {
        ...rawFormValue,
        examCreatedDate: Math.floor(Date.now() / 1000),
        sections: rawFormValue.sections.map((section: any) => ({
          ...section,
          questions: section.questions.map((question: any) => ({
            ...question,
            options: question.options.map((opt: string) => {
              const trimmed = opt.trim();
              // Prevent double-wrapping if the admin manually typed the $ signs
              if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
                return trimmed;
              }
              // Wrap the LaTeX generated by MathLive in $ symbols
              return `$${trimmed}$`;
            })
          }))
        }))
      };
      
      this.communicationService.createExam(finalPayload).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          alert('🎉 New exam created and published successfully!');
          
          const currentType = this.examForm.get('examType')?.value || 'FREE';
          this.router.navigate(['/exam'], { queryParams: { type: currentType } });
        },
        error: (error) => {
          console.error('Error creating exam:', error);
          this.isSubmitting = false;
          alert('Failed to save the exam. Please verify values and try again.');
        }
      });
    } else {
      this.examForm.markAllAsTouched();
    }
  }

  // 1. Calculates the actual number of question blocks created across all sections
  get totalAddedQuestionsCount(): number {
    let count = 0;
    this.sections.controls.forEach(section => {
      const questionsArray = section.get('questions') as FormArray;
      if (questionsArray) {
        count += questionsArray.length;
      }
    });
    return count;
  }

  // 2. Returns true if the actual questions meet or exceed the total limit
  get isQuestionLimitReached(): boolean {
    const maxLimit = this.examForm.get('totalQuestions')?.value || 0;
    return maxLimit > 0 && this.totalAddedQuestionsCount >= maxLimit;
  }

  // --- Diagram Upload Logic ---
  onDiagramUpload(event: any, sectionIndex: number, questionIndex: number) {
    const file: File = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, etc).');
      event.target.value = '';
      return;
    }

    const examType = this.examForm.get('examType')?.value || 'FREE';
    // Clean filename to prevent S3 issues
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); 

    this.isUploadingDiagram = true;
    this.uploadingQuestionCoords = { s: sectionIndex, q: questionIndex };

    let finalFileUrl = '';

    this.communicationService.generateDiagramPresignedUrl(cleanFileName, examType, file.type)
      .pipe(
        switchMap((response: any) => {
          // Adjust to match your exact backend response properties
          const uploadUrl = response.uploadUrl || response.presignedUrl; 
          finalFileUrl = response.fileUrl; 
          
          return this.communicationService.uploadFileToS3(uploadUrl, file);
        })
      )
      .subscribe({
        next: () => {
          // Success! Patch the received fileUrl into the form control
          this.getQuestions(sectionIndex).at(questionIndex).patchValue({
            diagramUrl: finalFileUrl
          });
          this.isUploadingDiagram = false;
          this.uploadingQuestionCoords = null;
        },
        error: (err) => {
          console.error('Diagram upload failed', err);
          alert('Failed to upload diagram. Please try again.');
          this.isUploadingDiagram = false;
          this.uploadingQuestionCoords = null;
          event.target.value = ''; // Reset input
        }
      });
  }

  removeDiagram(sectionIndex: number, questionIndex: number) {
    this.getQuestions(sectionIndex).at(questionIndex).patchValue({
      diagramUrl: null
    });
  }

  // Converts 0, 1, 2, 3 into A, B, C, D
  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index); 
  }

  // Captures the visual math input and saves the raw LaTeX to the form
  updateMathOption(sIndex: number, qIndex: number, oIndex: number, event: Event) {
    const mathField = event.target as any;
    this.getOptions(sIndex, qIndex).at(oIndex).setValue(mathField.value);
  }
}