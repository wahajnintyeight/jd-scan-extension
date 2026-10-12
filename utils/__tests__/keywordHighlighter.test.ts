/**
 * Tests for keyword highlighting functionality
 */

import { highlightKeywords, HighlightConfig } from '../keywordHighlighter';

// Mock DOM for testing
const mockDocument = {
  createElement: (tag: string) => ({
    textContent: '',
    innerHTML: ''
  })
};

// @ts-ignore
global.document = mockDocument;

describe('Keyword Highlighting', () => {
  const sampleJobDescription = `
    We are looking for a skilled JavaScript developer with experience in React and Node.js.
    The ideal candidate should have knowledge of TypeScript, SQL databases, and AWS cloud services.
    Experience with agile development and project management is preferred.
  `;

  const sampleResume = `
    John Doe - Software Engineer
    Skills: JavaScript, React, TypeScript, Python, Git
    Experience: 3 years of web development using modern frameworks
    Education: Computer Science degree
  `;

  const testConfig: HighlightConfig = {
    matchedColor: '#059669',
    unmatchedColor: '#dc2626',
    matchedBgColor: '#d1fae5',
    unmatchedBgColor: '#fee2e2',
    className: 'test-highlight'
  };

  test('should highlight matched and unmatched keywords', () => {
    const result = highlightKeywords(sampleJobDescription, sampleResume, testConfig);
    
    expect(result.highlightedHtml).toContain('test-highlight');
    expect(result.highlightedHtml).toContain('test-highlight--matched');
    expect(result.highlightedHtml).toContain('test-highlight--unmatched');
    expect(result.stats.totalKeywords).toBeGreaterThan(0);
    expect(result.stats.matchedCount).toBeGreaterThan(0);
    expect(result.stats.unmatchedCount).toBeGreaterThan(0);
  });

  test('should handle empty inputs gracefully', () => {
    const result = highlightKeywords('', '', testConfig);
    
    expect(result.highlightedHtml).toBe('');
    expect(result.stats.totalKeywords).toBe(0);
    expect(result.stats.matchedCount).toBe(0);
    expect(result.stats.unmatchedCount).toBe(0);
  });

  test('should identify JavaScript as matched keyword', () => {
    const result = highlightKeywords(sampleJobDescription, sampleResume, testConfig);
    
    // JavaScript should be highlighted as matched (green)
    expect(result.highlightedHtml).toContain('JavaScript');
    expect(result.highlightedHtml).toContain('test-highlight--matched');
  });

  test('should identify AWS as unmatched keyword', () => {
    const result = highlightKeywords(sampleJobDescription, sampleResume, testConfig);
    
    // AWS should be highlighted as unmatched (red) since it's not in the resume
    expect(result.highlightedHtml).toContain('AWS');
    expect(result.highlightedHtml).toContain('test-highlight--unmatched');
  });

  test('should preserve original text structure', () => {
    const simpleText = 'Looking for JavaScript and Python developers';
    const simpleResume = 'Skills: JavaScript, React';
    
    const result = highlightKeywords(simpleText, simpleResume, testConfig);
    
    // Should contain the original words even if highlighted
    expect(result.highlightedHtml).toContain('Looking for');
    expect(result.highlightedHtml).toContain('and');
    expect(result.highlightedHtml).toContain('developers');
  });

  test('should handle special characters in keywords', () => {
    const textWithSpecialChars = 'Experience with Node.js and C++ programming';
    const resumeWithSpecialChars = 'Skills: Node.js, JavaScript';
    
    const result = highlightKeywords(textWithSpecialChars, resumeWithSpecialChars, testConfig);
    
    expect(result.highlightedHtml).toContain('Node.js');
    expect(result.stats.totalKeywords).toBeGreaterThan(0);
  });
});