import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CommunicationService } from '../../service/communication/communication.service';
import { NotificationService } from '../../service/notification.service';
import { ExamBuilderComponent } from './exam-builder.component';

describe('ExamBuilderComponent', () => {
  let component: ExamBuilderComponent;
  let fixture: ComponentFixture<ExamBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamBuilderComponent],
      providers: [
        {
          provide: CommunicationService,
          useValue: {
            generateDiagramPresignedUrl: () => of({ uploadUrl: 'https://example.com', fileUrl: 'https://example.com/file' }),
            uploadFileToS3: () => of({})
          }
        },
        {
          provide: NotificationService,
          useValue: {
            showError: jasmine.createSpy('showError')
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a compact draft status bar when a draft restore banner is shown', () => {
    component.mode = 'create';
    component.showRestoreBanner = true;
    fixture.detectChanges();

    const draftStatusBar = fixture.nativeElement.querySelector('.draft-status-bar');
    expect(draftStatusBar).toBeTruthy();
  });

  it('swaps to the unsaved state after a restored draft starts changing', () => {
    component.mode = 'create';
    component.showRestoreBanner = true;
    component.hasUnsavedChanges = false;

    (component as any).scheduleDebounceSave();

    expect(component.showRestoreBanner).toBeFalse();
    expect(component.hasUnsavedChanges).toBeTrue();
  });

  it('prefers a restored draft over initial exam data in edit mode', async () => {
    component.mode = 'edit';
    component.initialData = { examId: 'exam-1', title: 'Server title' };
    component.examForm = component['fb'].group({
      examId: ['exam-1'],
      title: [''],
      sections: component['fb'].array([])
    });

    spyOn(component, 'restoreDraftFromStorage').and.resolveTo({ savedAt: '2026-07-20T12:00:00.000Z' });
    const populateSpy = spyOn(component, 'populateForm');

    await (component as any).initializeFormFromDraftOrInitialData();

    expect(component.showRestoreBanner).toBeTrue();
    expect(populateSpy).not.toHaveBeenCalled();
  });

  it('shows the discard dialog when a draft has already been saved', () => {
    component.mode = 'create';
    component.hasUnsavedChanges = false;
    component.showRestoreBanner = false;
    component.lastSavedAtISO = '2026-07-20T12:00:00.000Z';

    component.handleCancelNavigation();

    expect(component.confirmDialogConfig).toBeTruthy();
    expect(component.confirmDialogConfig?.title).toBe('Discard Unsaved Changes');
  });

  it('swaps to the saved badge when there is no active draft state', () => {
    component.mode = 'create';
    component.showRestoreBanner = false;
    component.hasUnsavedChanges = false;
    component.lastSavedAtISO = '2026-07-20T12:00:00.000Z';
    fixture.detectChanges();

    const draftStatusBar = fixture.nativeElement.querySelector('.draft-status-bar');
    const savedBadge = fixture.nativeElement.querySelector('.last-saved-indicator');

    expect(draftStatusBar).toBeNull();
    expect(savedBadge).toBeTruthy();
  });
});
