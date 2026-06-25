// src/app/pipes/markdown.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';

    let html = value;

    // Escape HTML (but preserve our markdown syntax)
    html = html.replace(/&/g, '&amp;');
    html = html.replace(/</g, '&lt;');
    html = html.replace(/>/g, '&gt;');

    // Headings (# H1, ## H2, ### H3)
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Bold (**text**) and Italic (*text*) - process bold first
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Strikethrough (~~text~~)
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Inline code (`code`)
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Unordered lists (- item or * item)
    const lines = html.split('\n');
    let inList = false;
    const result: string[] = [];

    for (const line of lines) {
      if (/^- (.*)$/.test(line.trim()) || /^\* (.*)$/.test(line.trim())) {
        const content = line.replace(/^- /, '').replace(/^\* /, '');
        if (!inList) {
          result.push('<ul>');
          inList = true;
        }
        result.push('<li>' + content + '</li>');
      } else if (/^\d+\. (.*)$/.test(line.trim())) {
        const content = line.replace(/^\d+\. /, '');
        if (!inList) {
          result.push('<ol>');
          inList = true;
        }
        result.push('<li>' + content + '</li>');
      } else {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(line);
      }
    }

    if (inList) {
      result.push('</ul>');
    }

    return result.join('\n');
  }
}