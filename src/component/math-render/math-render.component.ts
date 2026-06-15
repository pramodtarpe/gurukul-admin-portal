import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';

// @ts-ignore
import renderMathInElement from 'katex/contrib/auto-render';

// ADD THIS LINE: Enables \ce{} Chemistry commands
import 'katex/contrib/mhchem/mhchem';

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
      this.mathContainer.nativeElement.innerHTML = this.content || '';

      renderMathInElement(this.mathContainer.nativeElement, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false } 
        ],
        throwOnError: false
      });
    }
  }
}