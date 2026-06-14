import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MathRenderComponent } from './math-render.component';

describe('MathRenderComponent', () => {
  let component: MathRenderComponent;
  let fixture: ComponentFixture<MathRenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MathRenderComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MathRenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
