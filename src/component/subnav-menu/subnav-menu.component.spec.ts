import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubnavMenuComponent } from './subnav-menu.component';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

describe('SubnavMenuComponent', () => {
  let component: SubnavMenuComponent;
  let fixture: ComponentFixture<SubnavMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubnavMenuComponent, CommonModule, RouterLink, RouterLinkActive]
    }).compileComponents();

    fixture = TestBed.createComponent(SubnavMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in expanded state by default', () => {
    expect(component.collapsed).toBe(false);
  });

  it('should toggle collapsed state on toggleCollapse call', () => {
    component.toggleCollapse();
    expect(component.collapsed).toBe(true);

    component.toggleCollapse();
    expect(component.collapsed).toBe(false);
  });
});