import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter, SimpleChanges, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CommunicationService } from '../../service/communication/communication.service';
import { MathRenderComponent } from '../math-render/math-render.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { switchMap } from 'rxjs';
import 'mathlive';
import { NotificationService } from '../../service/notification.service';

// ============================================================
// IndexedDB Helpers — Lightweight wrapper (no external deps)
// ============================================================

/** Default IndexedDB name and object store for exam drafts. */
const INDEXED_DB_NAME = 'GurukulAdminDB';
const DRAFT_STORE_NAME = 'examDrafts';
const DB_VERSION = 1;

interface DraftRecord {
  /** Composite key: "create" or "edit-{examId}" */
  id: string;
  formValue: any;
  activeSectionIndex?: number;
  activeQuestionIndex?: number;
  savedAt: string; // ISO timestamp
}

class IndexedDBHelper {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  /** Opens (or reuses) the database connection. */
  private async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (!this.openPromise) {
      this.openPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(INDEXED_DB_NAME, DB_VERSION);
        // Upgrade on first install or when bumping DB_VERSION
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
            const store = db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
            // Index for querying by id (useful but not strictly necessary)
            store.createIndex('byId', 'id', { unique: true });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    this.db = await this.openPromise;
    return this.db;
  }

  /** Saves a draft record. */
  async saveDraft(draft: DraftRecord): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      tx.objectStore(DRAFT_STORE_NAME).put(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Retrieves a draft by its composite key. Returns null if not found. */
  async getDraft(id: string): Promise<DraftRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
      const request = tx.objectStore(DRAFT_STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /** Removes a draft by its composite key. */
  async deleteDraft(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      tx.objectStore(DRAFT_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Shared singleton instance across all component instances
const draftDb = new IndexedDBHelper();

/** Formats an ISO timestamp to "HH:MM AM/PM" (12-hour clock). */
function formatSavedAt(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

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
  @Input() draftScopeId: string | null = null;

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

  // ============================================================
  // Draft / IndexedDB State
  // ============================================================
  private readonly DRAFT_STORAGE_KEY_PREFIX = 'exam-draft-';
  private draftDebounceTimer: any = null;
  /** ISO timestamp of the last *successfully saved* draft. */
  public lastSavedAtISO: string | null = null;
  /** Whether there are local unsaved changes since last save/restore. */
  public hasUnsavedChanges: boolean = false;
  /** True while an auto-save is in-flight (debounce timer fired, IndexedDB write pending). */
  public isSavingDraft: boolean = false;
  public showRestoreBanner: boolean = false;

  /** Primary composite key derived from mode + examId (if editing). */
  get storageKey(): string {
    const resolvedId = this.draftScopeId || this.initialData?.examId || this.examForm?.get('examId')?.value;
    if (this.mode === 'edit' && resolvedId) {
      return `${this.DRAFT_STORAGE_KEY_PREFIX}${resolvedId}`;
    }
    return `${this.DRAFT_STORAGE_KEY_PREFIX}create`;
  }

  /** All candidate draft keys to check for edit-mode fallbacks. */
  get draftStorageKeys(): string[] {
    if (this.mode === 'edit') {
      const keys = new Set<string>();
      const primaryKey = this.storageKey;
      if (primaryKey) {
        keys.add(primaryKey);
      }
      if (this.draftScopeId || this.initialData?.examId || this.examForm?.get('examId')?.value) {
        keys.add(`${this.DRAFT_STORAGE_KEY_PREFIX}create`);
      }
      return Array.from(keys);
    }
    return [this.storageKey];
  }

  /** Returns true when there's nothing meaningful to save in this exam. */
  isFormEmptyForDraft(): boolean {
    const title = this.examForm.get('title')?.value;
    const hasSections = this.sections.length > 0;
    return !(title && hasSections);
  }

  /** Shows the compact draft status bar when the builder has draft activity to surface. */
  get showDraftStatusBar(): boolean {
    return (this.showRestoreBanner || this.hasUnsavedChanges) && (this.mode === 'create' || this.mode === 'edit');
  }

  /** Shows the saved-status badge when there is a confirmed save and no draft activity is active. */
  get showLastSavedIndicator(): boolean {
    return !!this.lastSavedAtISO && !this.showDraftStatusBar;
  }

  // ============================================================
  // IndexedDB save / restore helpers
  // ============================================================

  /** Serialises the current form state and writes it to IndexedDB. */
  async saveDraftToStorage(): Promise<void> {
    if (!this.isFormValidForDraft()) return;

    this.isSavingDraft = true;
    try {
      const draftSavedAt = new Date().toISOString();
      const savePromises = this.draftStorageKeys.map((key) => {
        const draft: DraftRecord = {
          id: key,
          formValue: this.examForm.value,
          activeSectionIndex: this.activeSectionIndex,
          activeQuestionIndex: this.activeQuestionIndex,
          savedAt: draftSavedAt
        };
        return draftDb.saveDraft(draft);
      });

      await Promise.all(savePromises);
      // Update the "last saved" timestamp
      this.lastSavedAtISO = draftSavedAt;
      this.hasUnsavedChanges = false;
    } catch (err) {
      console.error('Failed to save draft to IndexedDB:', err);
    } finally {
      this.isSavingDraft = false;
    }
  }

  /** Checks whether the form has enough data to persist a draft. */
  isFormValidForDraft(): boolean {
    const title = this.examForm.get('title')?.value;
    return !!(title && this.sections.length > 0);
  }

  /** Returns true when the submit button should be disabled. */
  get isSubmitDisabled(): boolean {
    if (this.isSubmitting) return true;
    if (this.examForm.invalid) return true;
    if (this.mode === 'create' && this.totalAddedQuestionsCount !== this.examForm.get('totalQuestions')?.value) return true;
    return false;
  }

  /** Returns true when the exam metadata required for creating sections is valid. */
  get canAddSections(): boolean {
    const title = this.examForm?.get('title')?.value;
    const totalQuestions = this.examForm?.get('totalQuestions')?.value;
    const totalMarks = this.examForm?.get('totalMarks')?.value;
    const timeLimitMinutes = this.examForm?.get('timeLimitMinutes')?.value;
    const examType = this.examForm?.get('examType')?.value;

    return !!(
      title &&
      typeof title === 'string' && title.trim().length > 0 &&
      examType &&
      typeof totalQuestions === 'number' && totalQuestions > 0 &&
      typeof totalMarks === 'number' && totalMarks > 0 &&
      typeof timeLimitMinutes === 'number' && timeLimitMinutes > 0
    );
  }

  /** Restores a previously saved draft from IndexedDB into the form. Returns `null` if no draft found. */
  async restoreDraftFromStorage(): Promise<{ savedAt: string } | null> {
    try {
      for (const key of this.draftStorageKeys) {
        const record = await draftDb.getDraft(key);
        if (!record || !record.formValue?.title) continue;

        const { sections: _, ...restFormValue } = record.formValue || {};
        this.examForm.patchValue(restFormValue);
        this.sections.clear();

        // Rebuild sections array from stored data
        if (record.formValue.sections) {
          record.formValue.sections.forEach((section: any) => {
            const sectionGroup = this.fb.group({
              sectionId: [section.sectionId || null],
              sectionTitle: [section.sectionTitle || '', Validators.required],
              sectionTotalQuestions: [section.sectionTotalQuestions || null, [Validators.required, Validators.min(1)]],
              sectionTotalMarks: [section.sectionTotalMarks || null, [Validators.required, Validators.min(1)]],
              questions: this.fb.array([])
            });

            const questionsArray = sectionGroup.get('questions') as FormArray;
            if (section.questions && section.questions.length > 0) {
              section.questions.forEach((question: any) => {
                const questionGroup = this.fb.group({
                  questionId: [question.questionId || null],
                  text: [question.text || '', Validators.required],
                  diagramUrl: [question.diagramUrl || null],
                  correctAnswersIndex: [question.correctAnswersIndex != null ? question.correctAnswersIndex : 0, [Validators.required, Validators.min(0), Validators.max(3)]],
                  options: this.fb.array([])
                });

                const optionsArray = questionGroup.get('options') as FormArray;
                if (question.options && question.options.length > 0) {
                  question.options.forEach((opt: string) => optionsArray.push(this.fb.control(opt, Validators.required)));
                }
                questionsArray.push(questionGroup);
              });
            }
            this.sections.push(sectionGroup);
          });
        }

        // Restore cursor position in the editor UI
        this.activeSectionIndex = record.activeSectionIndex ?? 0;
        this.activeQuestionIndex = record.activeQuestionIndex ?? 0;
        this.examForm.updateValueAndValidity();
        this.setActiveQuestion(this.activeSectionIndex, this.activeQuestionIndex);

        return { savedAt: record.savedAt };
      }
    } catch (err) {
      console.error('Failed to restore draft from IndexedDB:', err);
    }
    return null;
  }

  /** Deletes the stored draft from IndexedDB. */
  async clearDraftStorage(): Promise<void> {
    try {
      await Promise.all(this.draftStorageKeys.map((key) => draftDb.deleteDraft(key)));
      this.lastSavedAtISO = null;
      this.hasUnsavedChanges = false;
      this.showRestoreBanner = false;
    } catch (err) {
      console.error('Failed to clear draft from IndexedDB:', err);
    }
  }

  // ============================================================
  // Debounce + top-level subscription wiring
  // ============================================================

  /** Schedules a deferred save after the user has stopped typing. */
  private scheduleDebounceSave(): void {
    if (this.draftDebounceTimer) {
      clearTimeout(this.draftDebounceTimer);
    }
    this.hasUnsavedChanges = true;
    this.showRestoreBanner = false;
    this.draftDebounceTimer = setTimeout(() => {
      // Fire-and-forget async save to avoid blocking change detection
      this.saveDraftToStorage();
    }, 2000);
  }

  /**
   * Single top-level subscription — listens only on the root form.valueChanges.
   * Because Angular's Reactive Forms propagate nested changes up through parent controls,
   * we don't need to subscribe to every individual FormArray/FormControl. One listener is enough.
   */
  private setupFormChangeTracking(): void {
    if (!this.examForm) return;

    this.examForm.valueChanges.subscribe(() => {
      this.scheduleDebounceSave();
    });
  }

  // ============================================================
  // Diagram Upload State
  // ============================================================
  uploadingQuestionCoords: { s: number, q: number } | null = null;

  // ============================================================
  // Math Builder Modal
  // ============================================================
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

  // ============================================================
  // Lifecycle Hooks
  // ============================================================

  ngOnDestroy() {
    if (this.draftDebounceTimer) {
      clearTimeout(this.draftDebounceTimer);
    }
  }

  async ngOnInit() {
    if (!this.examForm) {
      this.initForm();
    }
    this.setupFormChangeTracking();

    if (this.mode === 'edit' && !this.initialData?.examId) {
      return;
    }

    // Restore draft asynchronously so the form is ready first.
    // In edit mode, this should happen before the server payload is applied.
    const restoreInfo = await this.restoreDraftFromStorage();
    if (restoreInfo) {
      this.showRestoreBanner = true;
      this.lastSavedAtISO = restoreInfo.savedAt;
    } else if (this.mode === 'edit' && this.initialData) {
      this.populateForm(this.initialData);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialData'] && this.initialData) {
      if (this.mode === 'edit') {
        void this.initializeFormFromDraftOrInitialData();
      } else {
        this.populateForm(this.initialData);
      }
    }
  }

  private async initializeFormFromDraftOrInitialData(): Promise<void> {
    if (!this.examForm) {
      this.initForm();
    }

    const restoreInfo = await this.restoreDraftFromStorage();
    if (restoreInfo) {
      this.showRestoreBanner = true;
      this.lastSavedAtISO = restoreInfo.savedAt;
      return;
    }

    this.populateForm(this.initialData);
  }

  // ============================================================
  // Form Initialisation / Population
  // ============================================================

  initForm() {
    this.examForm = this.fb.group({
      examId: [''],
      title: ['', Validators.required],
      totalQuestions: [null, [Validators.required, Validators.min(1)]],
      totalMarks: [{ value: null, disabled: true }, [Validators.required, Validators.min(1)]],
      timeLimitMinutes: [null, [Validators.required, Validators.min(1)]],
      examType: ['FREE', Validators.required],
      sections: this.fb.array([])
    }, { validators: this.validateTotalQuestions });

    this.examForm.get('totalQuestions')?.valueChanges.subscribe((value: number | null) => {
      const normalized = typeof value === 'number' && value > 0 ? value : null;
      this.examForm.patchValue({ totalMarks: normalized }, { emitEvent: false });
    });
  }

  populateForm(data: any) {
    if (!this.examForm) this.initForm();

    this.examForm.patchValue({
      examId: data.examId,
      title: data.title,
      totalQuestions: data.totalQuestions,
      totalMarks: data.totalQuestions,
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

  // ============================================================
  // Form Array Accessors (concise helpers)
  // ============================================================

  get sections() { return this.examForm.get('sections') as FormArray; }
  getQuestions(sIndex: number) { return this.sections.at(sIndex).get('questions') as FormArray; }
  getOptions(sIndex: number, qIndex: number) { return this.getQuestions(sIndex).at(qIndex).get('options') as FormArray; }
  getCorrectAnswerControl(sIndex: number, qIndex: number): FormControl {
    return this.getQuestions(sIndex).at(qIndex).get('correctAnswersIndex') as FormControl;
  }

  /** True when all core exam fields have valid values. */
  get isExamDetailsValid(): boolean {
    return !!(this.examForm.get('title')?.valid && this.examForm.get('totalQuestions')?.valid && this.examForm.get('totalMarks')?.valid && this.examForm.get('timeLimitMinutes')?.valid);
  }

  // ============================================================
  // Section / Question CRUD
  // ============================================================

  setActiveQuestion(sIndex: number, qIndex: number) {
    this.activeSectionIndex = sIndex;
    this.activeQuestionIndex = qIndex;
  }

  isQuestionInvalid(sIndex: number, qIndex: number): boolean {
    const qGroup = this.getQuestions(sIndex).at(qIndex);
    return qGroup ? qGroup.invalid && qGroup.touched : false;
  }

  /** Sum of all `sectionTotalQuestions` values. */
  get currentAllocatedQuestions(): number {
    return this.sections.controls.reduce((sum, sec) => sum + (sec.get('sectionTotalQuestions')?.value || 0), 0);
  }

  /** Actual count of question controls across all sections. */
  get totalAddedQuestionsCount(): number {
    return this.sections.controls.reduce((sum, sec) => sum + (sec.get('questions') as FormArray).length, 0);
  }

  /** Returns true when no more questions can be added (user hit the exam total cap). */
  get isQuestionLimitReached(): boolean {
    const maxLimit = this.examForm.get('totalQuestions')?.value || 0;
    return maxLimit > 0 && this.totalAddedQuestionsCount >= maxLimit;
  }

  /** Cross-validator: ensures section-level question counts don't exceed the exam total. */
  validateTotalQuestions(control: AbstractControl): ValidationErrors | null {
    const total = control.get('totalQuestions')?.value || 0;
    const sections = control.get('sections') as FormArray;
    if (!sections) return null;
    let acc = 0;
    sections.controls.forEach(sec => acc += (sec.get('sectionTotalQuestions')?.value || 0));
    return acc > total ? { questionLimitExceeded: true } : null;
  }

  addSection() {
    if (!this.canAddSections) {
      this.examForm.markAllAsTouched();
      this.examForm.get('title')?.markAsTouched();
      this.examForm.get('totalQuestions')?.markAsTouched();
      this.examForm.get('totalMarks')?.markAsTouched();
      this.examForm.get('timeLimitMinutes')?.markAsTouched();
      this.examForm.get('examType')?.markAsTouched();
      return;
    }

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

  async discardCurrentDraft(): Promise<void> {
    await this.clearDraftStorage();
    this.showRestoreBanner = false;
    if (this.mode === 'create') {
      this.initForm();
      this.setupFormChangeTracking();
    }
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

  // ============================================================
  // Math Detection / Preview Helpers
  // ============================================================

  containsMath(text: string | null | undefined): boolean {
    if (!text) return false;
    const hasDollarMath = (text.match(/\$/g) || []).length >= 2;
    const hasBracketMath = text.includes('\\[') && text.includes('\\]');
    const hasParenMath = text.includes('\\(') && text.includes('\\)');
    return hasDollarMath || hasBracketMath || hasParenMath;
  }

  activeOptionPreviews: Set<string> = new Set<string>();

  toggleOptionPreview(sIndex: number, qIndex: number, oIndex: number): void {
    const key = `s${sIndex}q${qIndex}o${oIndex}`;
    this.activeOptionPreviews.has(key) ? this.activeOptionPreviews.delete(key) : this.activeOptionPreviews.add(key);
  }

  isOptionPreviewActive(sIndex: number, qIndex: number, oIndex: number): boolean {
    return this.activeOptionPreviews.has(`s${sIndex}q${qIndex}o${oIndex}`);
  }

  // ============================================================
  // Diagram Upload
  // ============================================================

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

  // ============================================================
  // Confirm Dialog
  // ============================================================

  handleConfirm(): void {
    if (this.confirmDialogConfig?.action) {
      this.confirmDialogConfig.action();
    }
  }

  handleCancel(): void {
    this.confirmDialogConfig = null;
  }

  /** Guard for cancel navigation — prompts about unsaved changes or previously saved drafts. */
  handleCancelNavigation(): void {
    const hasPersistedDraft = !!this.lastSavedAtISO || this.showRestoreBanner || this.hasUnsavedChanges;

    if (hasPersistedDraft) {
      const title = 'Discard Unsaved Changes';
      const message = `You have ${this.showRestoreBanner ? 'a restored draft' : 'unsaved work'} on this exam. Do you want to discard it and go back?`;
      this.confirmDialogConfig = {
        title,
        message,
        confirmText: 'Discard & Go Back',
        cancelText: 'Keep Editing',
        isDangerous: true,
        action: () => {
          this.clearDraftStorage();
          this.cancel.emit();
        }
      };
    } else {
      this.cancel.emit();
    }
  }

  /** Called from parent component after a successful publish/save. */
  onPublishSuccess(): void {
    this.clearDraftStorage();
  }

  // ============================================================
  // Rich Text Formatting (Question & Option text)
  // ============================================================

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
      // Wrap highlighted text with tags
      newText = text.substring(0, start) + openTag + selectedText + closeTag + text.substring(end);
      newCursorPos = end + openTag.length + closeTag.length;
    } else {
      // Insert empty tags at cursor position for inline editing
      newText = text.substring(0, start) + openTag + closeTag + text.substring(end);
      newCursorPos = start + openTag.length;
    }

    control.patchValue(newText);
    control.markAsDirty();

    // Restore focus and selection after Angular's change detection
    setTimeout(() => {
      element.focus();
      element.selectionStart = newCursorPos;
      element.selectionEnd = newCursorPos;
    }, 0);
  }

  // ============================================================
  // Math Builder Modal Logic
  // ============================================================

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

  // ============================================================
  // Form Submission
  // ============================================================

  triggerSubmit() {
    // Persist final draft before submission attempt so the user can resume if it fails
    this.saveDraftToStorage();

    if (this.examForm.valid) {
      const formValue = this.examForm.value;
      this.save.emit(formValue);
    } else {
      this.examForm.markAllAsTouched();
    }
  }
}