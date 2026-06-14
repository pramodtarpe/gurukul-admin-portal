// math-render.component.ts
import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';

// @ts-ignore - Bypasses strict TS checks for the auto-render extension
import renderMathInElement from 'katex/contrib/auto-render';

@Component({
  selector: 'ga-math-render',
  standalone: true,
  template: `<div #mathContainer></div>`
})
export class MathRenderComponent implements OnChanges {
  @Input() content: string = '';
  @ViewChild('mathContainer', { static: true }) mathContainer!: ElementRef;

  ngOnChanges(changes: SimpleChanges) {
    if (this.mathContainer && changes['content']) {
      // 1. Inject the raw mixed text into the container
      this.mathContainer.nativeElement.innerHTML = this.content || '';

      // 2. Command KaTeX to scan the container and transform the LaTeX segments
      renderMathInElement(this.mathContainer.nativeElement, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false } // Matches your specific string format
        ],
        throwOnError: false // Prevents the whole app from crashing if a formula has a syntax typo
      });
    }
  }
}