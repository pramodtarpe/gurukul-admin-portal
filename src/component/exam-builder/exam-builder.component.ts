import { Component, OnInit, OnChanges, Input, Output, EventEmitter, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { MathRenderComponent } from '../math-render/math-render.component';
import { switchMap } from 'rxjs';
import 'mathlive';

@Component({
  selector: 'ga-exam-builder',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, MathRenderComponent],
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

  activeSectionIndex: number = 0;
  activeQuestionIndex: number = 0;

  isUploadingDiagram: boolean = false;
  uploadingQuestionCoords: { s: number, q: number } | null = null;

  isMathBuilderOpen = false;
  mathBuilderTargetCoords: { s: number, q: number, type: 'question' | 'option', oIndex?: number } | null = null;
  currentMathFormula = '';

  constructor(private fb: FormBuilder, private communicationService: CommunicationService) { }

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
      sectionId: [null], // <-- Added this so the backend knows it's a new section
      sectionTitle: ['', Validators.required],
      sectionTotalQuestions: [null, [Validators.required, Validators.min(1)]],
      sectionTotalMarks: [null, [Validators.required, Validators.min(1)]],
      questions: this.fb.array([])
    }));
    this.addQuestion(this.sections.length - 1);
    this.setActiveQuestion(this.sections.length - 1, 0);
  }

  removeSection(sIndex: number) {
    if (confirm(`Delete Section ${sIndex + 1}?`)) {
      this.sections.removeAt(sIndex);
      this.setActiveQuestion(0, 0);
    }
  }

  addQuestion(sIndex: number) {
    this.getQuestions(sIndex).push(this.fb.group({
      questionId: [null], // <-- Added this so the backend knows it's a new question
      text: ['', Validators.required],
      diagramUrl: [null],
      correctAnswersIndex: [null, [Validators.required, Validators.min(0), Validators.max(3)]],
      options: this.fb.array([this.fb.control('', Validators.required), this.fb.control('', Validators.required), this.fb.control('', Validators.required), this.fb.control('', Validators.required)])
    }));
    this.setActiveQuestion(sIndex, this.getQuestions(sIndex).length - 1);
  }

  removeQuestion(sIndex: number, qIndex: number) {
    const questions = this.getQuestions(sIndex);
    if (questions.length <= 1) return alert("Sections must have at least one question.");
    questions.removeAt(qIndex);
    this.setActiveQuestion(sIndex, Math.max(0, qIndex - 1));
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // --- Math Detection Logic ---
  containsMath(text: string | null | undefined): boolean {
    if (!text) return false;

    // Checks if the string contains at least two '$' signs, or LaTeX bracket/parentheses delimiters
    const hasDollarMath = (text.match(/\$/g) || []).length >= 2;
    const hasBracketMath = text.includes('\\[') && text.includes('\\]');
    const hasParenMath = text.includes('\\(') && text.includes('\\)');

    return hasDollarMath || hasBracketMath || hasParenMath;
  }

  onDiagramUpload(event: any, sIndex: number, qIndex: number) {
    const file: File = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return alert('Please select a valid image.');

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
        alert('Upload failed.');
        this.isUploadingDiagram = false;
      }
    });
  }

  removeDiagram(sIndex: number, qIndex: number) {
    this.getQuestions(sIndex).at(qIndex).patchValue({ diagramUrl: null });
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