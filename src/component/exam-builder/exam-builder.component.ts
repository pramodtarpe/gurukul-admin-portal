import { Component, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { MathRenderComponent } from '../math-render/math-render.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { switchMap } from 'rxjs';
import 'mathlive';
import { NotificationService } from '../../service/notification.service';

@Component({
  selector: 'ga-exam-builder',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, MathRenderComponent, ConfirmDialogComponent],
  templateUrl: './exam-builder.component.html',
  styleUrl: './exam-builder.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ExamBuilderComponent implements OnInit, OnChanges {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() initialData: any = null;
  @Input() isSubmitting: boolean = false;

  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  examForm!: FormGroup;
  examTypes: string[] = ['FREE', 'FOREST_BHARTI', 'POLICE_BHARTI'];

  examTypeTranslations: { [key: string]: string } = {
    'FREE': 'मोफत चाचणी',
    'FOREST_BHARTI': 'वनरक्षक भरती',
    'POLICE_BHARTI': 'पोलीस भरती'
  };

  activeSectionIndex: number = 0;
  activeQuestionIndex: number = 0;

  isUploadingDiagram: boolean = false;
  uploadingQuestionCoords: { s: number, q: number } | null = null;

  isMathBuilderOpen = false;
  mathBuilderTargetCoords: { s: number, q: number, type: 'question' | 'option', oIndex?: number } | null = null;
  currentMathFormula = '';

  // Confirm dialog state
  confirmDialogConfig: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
    action: () => void;
  } | null = null;

  constructor(private fb: FormBuilder, private communicationService: CommunicationService, private notificationService: NotificationService) { }

  ngOnInit() {
    if (!this.examForm) {
      this.initForm();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialData'] && this.initialData) {
      this.populateForm(this.initialData);
    }
  }

  initForm() {
    this.examForm = this.fb.group({
      examId: [''],
      title: ['', Validators.required],
      totalQuestions: [null, [Validators.required, Validators.min(1)]],
      totalMarks: [null, [Validators.required, Validators.min(1)]],
      timeLimitMinutes: [null, [Validators.required, Validators.min(1)]],
      examType: ['FREE', Validators.required],
      sections: this.fb.array([])
    }, { validators: this.validateTotalQuestions });
  }

  populateForm(data: any) {
    if (!this.examForm) this.initForm();

    this.examForm.patchValue({
      examId: data.examId,
      title: data.title,
      totalQuestions: data.totalQuestions,
      totalMarks: data.totalMarks,
      timeLimitMinutes: data.timeLimitMinutes,
      examType: data.examType || 'FREE'
    });

    this.sections.clear();

    if (data.sections) {
      data.sections.forEach((section: any) => {
        const sectionGroup = this.fb.group({
          sectionId: [section.sectionId],
          sectionTitle: [section.sectionTitle, Validators.required],
          sectionTotalQuestions: [section.sectionTotalQuestions, [Validators.required, Validators.min(1)]],
          sectionTotalMarks: [section.sectionTotalMarks, [Validators.required, Validators.min(1)]],
          questions: this.fb.array([])
        });

        const questionsArray = sectionGroup.get('questions') as FormArray;

        if (section.questions) {
          section.questions.forEach((question: any) => {
            const questionGroup = this.fb.group({
              questionId: [question.questionId],
              text: [question.text, Validators.required],
              diagramUrl: [question.diagramUrl],
              correctAnswersIndex: [question.correctAnswersIndex, [Validators.required, Validators.min(0), Validators.max(3)]],
              options: this.fb.array([])
            });

            const optionsArray = questionGroup.get('options') as FormArray;
            if (question.options) {
              question.options.forEach((opt: string) => optionsArray.push(this.fb.control(opt, Validators.required)));
            }
            questionsArray.push(questionGroup);
          });
        }
        this.sections.push(sectionGroup);
      });
    }
    this.setActiveQuestion(0, 0);
  }

  get sections() { return this.examForm.get('sections') as FormArray; }
  getQuestions(sIndex: number) { return this.sections.at(sIndex).get('questions') as FormArray; }
  getOptions(sIndex: number, qIndex: number) { return this.getQuestions(sIndex).at(qIndex).get('options') as FormArray; }
  getCorrectAnswerControl(sIndex: number, qIndex: number): FormControl {
    return this.getQuestions(sIndex).at(qIndex).get('correctAnswersIndex') as FormControl;
  }

  get isExamDetailsValid(): boolean {
    return !!(this.examForm.get('title')?.valid && this.examForm.get('totalQuestions')?.valid && this.examForm.get('totalMarks')?.valid && this.examForm.get('timeLimitMinutes')?.valid);
  }

  setActiveQuestion(sIndex: number, qIndex: number) {
    this.activeSectionIndex = sIndex;
    this.activeQuestionIndex = qIndex;
  }

  isQuestionInvalid(sIndex: number, qIndex: number): boolean {
    const qGroup = this.getQuestions(sIndex).at(qIndex);
    return qGroup ? qGroup.invalid && qGroup.touched : false;
  }

  get currentAllocatedQuestions(): number {
    return this.sections.controls.reduce((sum, sec) => sum + (sec.get('sectionTotalQuestions')?.value || 0), 0);
  }

  get totalAddedQuestionsCount(): number {
    return this.sections.controls.reduce((sum, sec) => sum + (sec.get('questions') as FormArray).length, 0);
  }

  get isQuestionLimitReached(): boolean {
    const maxLimit = this.examForm.get('totalQuestions')?.value || 0;
    return maxLimit > 0 && this.totalAddedQuestionsCount >= maxLimit;
  }

  validateTotalQuestions(control: AbstractControl): ValidationErrors | null {
    const total = control.get('totalQuestions')?.value || 0;
    const sections = control.get('sections') as FormArray;
    if (!sections) return null;
    let acc = 0;
    sections.controls.forEach(sec => acc += (sec.get('sectionTotalQuestions')?.value || 0));
    return acc > total ? { questionLimitExceeded: true } : null;
  }

  addSection() {
    this.sections.push(this.fb.group({
      sectionId: [null],
      sectionTitle: ['', Validators.required],
      sectionTotalQuestions: [null, [Validators.required, Validators.min(1)]],
      sectionTotalMarks: [null, [Validators.required, Validators.min(1)]],
      questions: this.fb.array([])
    }));
    this.addQuestion(this.sections.length - 1);
    this.setActiveQuestion(this.sections.length - 1, 0);
  }

  removeSection(sIndex: number) {
    const sectionTitle = this.sections.at(sIndex).get('sectionTitle')?.value || `Section ${sIndex + 1}`;
    this.confirmDialogConfig = {
      title: 'Delete Section',
      message: `Are you sure you want to delete "${sectionTitle}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDangerous: true,
      action: () => {
        this.sections.removeAt(sIndex);
        this.setActiveQuestion(0, 0);
        this.confirmDialogConfig = null;
      }
    };
  }

  addQuestion(sIndex: number) {
    this.getQuestions(sIndex).push(this.fb.group({
      questionId: [null],
      text: ['', Validators.required],
      diagramUrl: [null],
      correctAnswersIndex: [null, [Validators.required, Validators.min(0), Validators.max(3)]],
      options: this.fb.array([this.fb.control('', Validators.required), this.fb.control('', Validators.required), this.fb.control('', Validators.required), this.fb.control('', Validators.required)])
    }));
    this.setActiveQuestion(sIndex, this.getQuestions(sIndex).length - 1);
  }

  removeQuestion(sIndex: number, qIndex: number) {
    const questions = this.getQuestions(sIndex);
    if (questions.length <= 1) return;
    questions.removeAt(qIndex);
    this.setActiveQuestion(sIndex, Math.max(0, qIndex - 1));
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // --- Math Detection Logic ---
  containsMath(text: string | null | undefined): boolean {
    if (!text) return false;

    const hasDollarMath = (text.match(/\$/g) || []).length >= 2;
    const hasBracketMath = text.includes('\\[') && text.includes('\\]');
    const hasParenMath = text.includes('\\(') && text.includes('\\)');

    return hasDollarMath || hasBracketMath || hasParenMath;
  }

  // --- Option Preview State ---
  activeOptionPreviews: Set<string> = new Set<string>();

  toggleOptionPreview(sIndex: number, qIndex: number, oIndex: number): void {
    const key = `s${sIndex}q${qIndex}o${oIndex}`;
    if (this.activeOptionPreviews.has(key)) {
      this.activeOptionPreviews.delete(key);
    } else {
      this.activeOptionPreviews.add(key);
    }
  }

  isOptionPreviewActive(sIndex: number, qIndex: number, oIndex: number): boolean {
    const key = `s${sIndex}q${qIndex}o${oIndex}`;
    return this.activeOptionPreviews.has(key);
  }

  onDiagramUpload(event: any, sIndex: number, qIndex: number) {
    const file: File = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.notificationService.showError('Please select a valid image file.');
      return;
    }

    this.isUploadingDiagram = true;
    this.uploadingQuestionCoords = { s: sIndex, q: qIndex };
    const examType = this.examForm.get('examType')?.value || 'FREE';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

    this.communicationService.generateDiagramPresignedUrl(cleanFileName, examType, file.type).pipe(
      switchMap((res: any) => this.communicationService.uploadFileToS3(res.uploadUrl || res.presignedUrl, file).pipe(
        switchMap(() => [res.fileUrl])
      ))
    ).subscribe({
      next: (fileUrl: any) => {
        this.getQuestions(sIndex).at(qIndex).patchValue({ diagramUrl: fileUrl });
        this.isUploadingDiagram = false;
        this.uploadingQuestionCoords = null;
      },
      error: () => {
        this.notificationService.showError('Failed to upload diagram. Please try again.');
        this.isUploadingDiagram = false;
        this.uploadingQuestionCoords = null;
      }
    });
  }

  removeDiagram(sIndex: number, qIndex: number) {
    const questionText = this.getQuestions(sIndex).at(qIndex).get('text')?.value || `Question ${qIndex + 1}`;
    this.confirmDialogConfig = {
      title: 'Remove Diagram',
      message: `Are you sure you want to remove the diagram from "${questionText}"?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDangerous: true,
      action: () => {
        this.getQuestions(sIndex).at(qIndex).patchValue({ diagramUrl: null });
        this.confirmDialogConfig = null;
      }
    };
  }

  handleConfirm(): void {
    if (this.confirmDialogConfig?.action) {
      this.confirmDialogConfig.action();
    }
  }

  handleCancel(): void {
    this.confirmDialogConfig = null;
  }

  // --- Rich Text Formatting Logic ---
  applyFormat(elementId: string, tag: 'b' | 'i' | 'u', control: AbstractControl | null): void {
    if (!control) return;
    const element = document.getElementById(elementId) as HTMLInputElement | HTMLTextAreaElement;
    if (!element) return;

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const text = control.value || '';

    const selectedText = text.substring(start, end);
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    let newText = text;
    let newCursorPos = start;

    if (selectedText) {
      // Wrap the highlighted text
      newText = text.substring(0, start) + openTag + selectedText + closeTag + text.substring(end);
      newCursorPos = end + openTag.length + closeTag.length;
    } else {
      // Drop empty tags at the cursor position
      newText = text.substring(0, start) + openTag + closeTag + text.substring(end);
      newCursorPos = start + openTag.length;
    }

    // Update the Angular Form Control securely
    control.patchValue(newText);
    control.markAsDirty();

    // Restore focus and cursor position after Angular digests the patchValue
    setTimeout(() => {
      element.focus();
      element.selectionStart = newCursorPos;
      element.selectionEnd = newCursorPos;
    }, 0);
  }

  openMathBuilder(s: number, q: number, type: 'question' | 'option', oIndex?: number) {
    this.mathBuilderTargetCoords = { s, q, type, oIndex };
    this.currentMathFormula = '';
    this.isMathBuilderOpen = true;
  }

  closeMathBuilder() {
    this.isMathBuilderOpen = false;
    this.mathBuilderTargetCoords = null;
  }

  updateMathBuilderContent(event: Event) {
    this.currentMathFormula = (event.target as any).value;
  }

  insertMathFormula() {
    if (!this.currentMathFormula || !this.mathBuilderTargetCoords) return;
    const formula = `$${this.currentMathFormula}$`;
    const { s, q, type, oIndex } = this.mathBuilderTargetCoords;
    const control = type === 'question' ? this.getQuestions(s).at(q).get('text') : this.getOptions(s, q).at(oIndex!);

    if (control) {
      const current = control.value || '';
      control.patchValue(current + (current ? ' ' : '') + formula);
      control.markAsDirty();
    }
    this.closeMathBuilder();
  }

  triggerSubmit() {
    if (this.examForm.valid) {
      this.save.emit(this.examForm.value);
    } else {
      this.examForm.markAllAsTouched();
    }
  }
}