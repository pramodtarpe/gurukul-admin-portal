import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubnavMenuComponent } from './subnav-menu.component';

describe('SubnavMenuComponent', () => {
  let component: SubnavMenuComponent;
  let fixture: ComponentFixture<SubnavMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubnavMenuComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SubnavMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
