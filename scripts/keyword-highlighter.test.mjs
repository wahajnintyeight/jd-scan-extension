import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { parseHTML } from 'linkedom';
import { load } from './extensionHarness.mjs';
const { highlightKeywords } = await load('utils/keywordHighlighter.ts', {});

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

  const testConfig = {
    matchedColor: '#059669',
    unmatchedColor: '#dc2626',
    matchedBgColor: '#d1fae5',
    unmatchedBgColor: '#fee2e2',
    className: 'test-highlight'
  };

  test('should highlight matched and unmatched keywords', () => {
    const result = highlightKeywords(sampleJobDescription, sampleResume, testConfig);
    
    assert.ok(result.highlightedHtml.includes('test-highlight'));
    assert.ok(result.highlightedHtml.includes('test-highlight--matched'));
    assert.ok(result.highlightedHtml.includes('test-highlight--unmatched'));
    assert.ok(result.stats.totalKeywords > 0);
    assert.ok(result.stats.matchedCount > 0);
    assert.ok(result.stats.unmatchedCount > 0);
  });

  test('should handle empty inputs gracefully', () => {
    const result = highlightKeywords('', '', testConfig);
    
    assert.equal(result.highlightedHtml, '');
    assert.equal(result.stats.totalKeywords, 0);
    assert.equal(result.stats.matchedCount, 0);
    assert.equal(result.stats.unmatchedCount, 0);
  });

  test('should identify JavaScript as matched keyword', () => {
    const result = highlightKeywords(sampleJobDescription, sampleResume, testConfig);
    
    // JavaScript should be highlighted as matched (green)
    assert.ok(result.highlightedHtml.includes('JavaScript'));
    assert.ok(result.highlightedHtml.includes('test-highlight--matched'));
  });

  test('should identify AWS as unmatched keyword', () => {
    const result = highlightKeywords(sampleJobDescription, sampleResume, testConfig);
    
    // AWS should be highlighted as unmatched (red) since it's not in the resume
    assert.ok(result.highlightedHtml.includes('AWS'));
    assert.ok(result.highlightedHtml.includes('test-highlight--unmatched'));
  });

  test('should preserve original text structure', () => {
    const simpleText = 'Looking for JavaScript and Python developers';
    const simpleResume = 'Skills: JavaScript, React';
    
    const result = highlightKeywords(simpleText, simpleResume, testConfig);
    
    // Should contain the original words even if highlighted
    const { document } = parseHTML(`<div>${result.highlightedHtml}</div>`);
    assert.equal(document.querySelector('div').textContent, simpleText);
  });

  test('should handle special characters in keywords', () => {
    const textWithSpecialChars = 'Experience with Node.js and C++ programming';
    const resumeWithSpecialChars = 'Skills: Node.js, JavaScript';
    
    const result = highlightKeywords(textWithSpecialChars, resumeWithSpecialChars, testConfig);
    
    assert.ok(result.highlightedHtml.includes('Node.js'));
    assert.ok(result.stats.totalKeywords > 0);
  });
});