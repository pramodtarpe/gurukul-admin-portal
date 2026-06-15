import { MathRenderComponent } from '../math-render/math-render.component';
import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommunicationService } from '../../service/communication/communication.service';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { switchMap } from 'rxjs/operators';
import 'mathlive';

@Component({
  selector: 'ga-edit-exam',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, CommonModule, MathRenderComponent],
  providers: [CommunicationService],
  templateUrl: './edit-exam.component.html',
  styleUrl: './edit-exam.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class EditExamComponent implements OnInit {
  examForm!: FormGroup;
  examId: string | null = null;
  isSubmitting: boolean = false;
  examTypes = ['FREE', 'POLICE_BHARTI', 'FOREST_BHARTI'];

  // --- Layout Navigation Tracking States ---
  activeSectionIndex: number = 0;
  activeQuestionIndex: number = 0;

  // --- Diagram Upload State ---
  isUploadingDiagram: boolean = false;
  uploadingQuestionCoords: { s: number, q: number } | null = null;

  constructor(
    private communicationService: CommunicationService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    this.initForm();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.examId = id;
        this.fetchExamData(id);
      } else {
        console.error('No exam ID found in the URL.');
      }
    });
  }

  fetchExamData(id: string) {
    this.communicationService.getExamById(id).subscribe(
      (response) => {
        this.populateForm(response);
      },
      (error) => {
        console.error('Error fetching exam data:', error);
      }
    );
  }

  initForm() {
    this.examForm = this.fb.group({
      examId: [''],
      title: ['', Validators.required],
      totalQuestions: [0, Validators.required],
      totalMarks: [0, Validators.required],
      timeLimitMinutes: [0, Validators.required],
      examCreatedDate: [''],
      examType: ['FREE', Validators.required],
      sections: this.fb.array([])
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

  // --- Helper Methods for Workspace Navigation ---
  setActiveQuestion(sectionIndex: number, questionIndex: number): void {
    this.activeSectionIndex = sectionIndex;
    this.activeQuestionIndex = questionIndex;
  }

  // Checks if a specific question group has any structural validation errors
  isQuestionInvalid(sectionIndex: number, questionIndex: number): boolean {
    const questionGroup = this.getQuestions(sectionIndex).at(questionIndex);
    return questionGroup ? questionGroup.invalid && questionGroup.touched : false;
  }

  populateForm(examData: any) {
    this.examForm.patchValue({
      examId: examData.examId,
      title: examData.title,
      totalQuestions: examData.totalQuestions,
      totalMarks: examData.totalMarks,
      timeLimitMinutes: examData.timeLimitMinutes,
      examCreatedDate: examData.examCreatedDate,
      examType: examData.examType
    });

    this.sections.clear();

    if (examData.sections) {
      examData.sections.forEach((section: any) => {
        const sectionGroup = this.fb.group({
          sectionId: [section.sectionId],
          sectionTitle: [section.sectionTitle, Validators.required],
          sectionTotalQuestions: [section.sectionTotalQuestions, Validators.required],
          sectionTotalMarks: [section.sectionTotalMarks, Validators.required],
          questions: this.fb.array([])
        });

        const questionsArray = sectionGroup.get('questions') as FormArray;

        if (section.questions) {
          section.questions.forEach((question: any) => {
            const questionGroup = this.fb.group({
              questionId: [question.questionId],
              text: [question.text, Validators.required],
              diagramUrl: [question.diagramUrl],
              correctAnswersIndex: [question.correctAnswersIndex, Validators.required],
              options: this.fb.array([])
            });

            const optionsArray = questionGroup.get('options') as FormArray;
            if (question.options) {
              question.options.forEach((option: string) => {
                optionsArray.push(this.fb.control(option, Validators.required)); // Removed unwrapLatex
              });
            }

            questionsArray.push(questionGroup);
          });
        }
        this.sections.push(sectionGroup);
      });
    }

    if (this.sections.length > 0 && this.getQuestions(0).length > 0) {
      this.setActiveQuestion(0, 0);
    }
  }

  onSubmit() {
    if (this.examForm.valid && this.examId) {
      this.isSubmitting = true;
      const savedType = this.examForm.get('examType')?.value || 'FREE';
      const rawFormValue = this.examForm.value;

      const finalPayload = {
        ...rawFormValue,
        title: rawFormValue.title,
        sections: rawFormValue.sections.map((section: any) => ({
          ...section,
          questions: section.questions.map((question: any) => ({
            ...question,
            text: question.text, // Removed wrapLatex
            options: question.options // Removed wrapLatex
          }))
        }))
      };

      this.communicationService.updateExam(this.examId, finalPayload).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          alert('Exam changes have been updated and saved successfully!');
          this.router.navigate(['/exam'], { queryParams: { type: savedType } });
        },
        error: (error) => {
          console.error('Error updating exam:', error);
          this.isSubmitting = false;
          alert('Failed to update the exam. Please try again.');
        }
      });
    } else {
      console.warn('The form is invalid. Please check the required fields.');
      this.examForm.markAllAsTouched();
    }
  }

  // --- External Input Handlers ---
  onDiagramUpload(event: any, sectionIndex: number, questionIndex: number) {
    const file: File = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, etc).');
      event.target.value = '';
      return;
    }

    const examType = this.examForm.get('examType')?.value || 'FREE';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    this.isUploadingDiagram = true;
    this.uploadingQuestionCoords = { s: sectionIndex, q: questionIndex };

    let finalFileUrl = '';

    this.communicationService.generateDiagramPresignedUrl(cleanFileName, examType, file.type)
      .pipe(
        switchMap((response: any) => {
          const uploadUrl = response.uploadUrl || response.presignedUrl;
          finalFileUrl = response.fileUrl;
          return this.communicationService.uploadFileToS3(uploadUrl, file);
        })
      )
      .subscribe({
        next: () => {
          const targetControl = this.getQuestions(sectionIndex).at(questionIndex).get('diagramUrl');
          targetControl?.patchValue(finalFileUrl);
          targetControl?.markAsDirty();
          this.isUploadingDiagram = false;
          this.uploadingQuestionCoords = null;
        },
        error: (err) => {
          console.error('Diagram upload failed', err);
          alert('Failed to upload diagram. Please try again.');
          this.isUploadingDiagram = false;
          this.uploadingQuestionCoords = null;
          event.target.value = '';
        }
      });
  }

  removeDiagram(sectionIndex: number, questionIndex: number) {
    const targetControl = this.getQuestions(sectionIndex).at(questionIndex).get('diagramUrl');
    targetControl?.patchValue(null);
    targetControl?.markAsDirty();
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // --- Math Formula Builder State ---
  isMathBuilderOpen = false;
  mathBuilderTargetCoords: { s: number, q: number, type: 'question' | 'option', oIndex?: number } | null = null;
  currentMathFormula = '';

  openMathBuilder(sIndex: number, qIndex: number, type: 'question' | 'option', oIndex?: number) {
    this.mathBuilderTargetCoords = { s: sIndex, q: qIndex, type, oIndex };
    this.currentMathFormula = '';
    this.isMathBuilderOpen = true;
  }

  closeMathBuilder() {
    this.isMathBuilderOpen = false;
    this.mathBuilderTargetCoords = null;
    this.currentMathFormula = '';
  }

  updateMathBuilderContent(event: Event) {
    const mf = event.target as any;
    this.currentMathFormula = mf.value;
  }

  insertMathFormula() {
    if (!this.currentMathFormula || !this.mathBuilderTargetCoords) {
      return;
    }

    const formulaToInsert = `$${this.currentMathFormula}$`;
    const { s, q, type, oIndex } = this.mathBuilderTargetCoords;

    let control: any = null;

    if (type === 'question') {
      control = this.getQuestions(s).at(q).get('text');
    } else if (type === 'option' && oIndex !== undefined) {
      control = this.getOptions(s, q).at(oIndex);
    }

    if (control) {
      const currentVal = control.value || '';
      control.patchValue(currentVal + (currentVal ? ' ' : '') + formulaToInsert);
      control.markAsDirty();
    }

    this.closeMathBuilder();
  }

  updateMathTitle(event: Event) {
    const mathField = event.target as any;
    this.examForm.get('title')?.setValue(mathField.value);
    this.examForm.markAsDirty();
  }

  wrapLatex(value: string): string {
    if (!value) return value;
    const trimmed = value.trim();
    if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
      return trimmed;
    }
    return `$${trimmed}$`;
  }

  // Removes $ tags when loading the exam so the Math Editor is clean
  unwrapLatex(value: string): string {
    if (!value) return value;
    let clean = value.trim();
    if (clean.startsWith('$') && clean.endsWith('$')) {
      return clean.substring(1, clean.length - 1);
    }
    return clean;
  }
}