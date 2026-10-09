/**
 * Keyword Highlighter Utility
 * Provides DRY functionality for highlighting matched/unmatched keywords in job descriptions
 */

import { extractKeywords, scanResume, ATSResult } from './atsScanner';

export interface HighlightConfig {
  matchedColor: string;
  unmatchedColor: string;
  matchedBgColor: string;
  unmatchedBgColor: string;
  className?: string;
}

export interface HighlightResult {
  highlightedHtml: string;
  stats: {
    totalKeywords: number;
    matchedCount: number;
    unmatchedCount: number;
  };
}

const DEFAULT_HIGHLIGHT_CONFIG: HighlightConfig = {
  matchedColor: '#059669', // green-600
  unmatchedColor: '#dc2626', // red-600
  matchedBgColor: '#d1fae5', // green-100
  unmatchedBgColor: '#fee2e2', // red-100
  className: 'jd-scan-highlight'
};

export function injectHighlightStyles(): void {
  if (document.getElementById('jd-scan-highlight-styles')) return;

  const styleElement = document.createElement('style');
  styleElement.id = 'jd-scan-highlight-styles';
  styleElement.textContent = `
    .jd-scan-highlight { display: inline; border-radius: 3px; padding: 1px 3px; margin: 0 1px; transition: all 0.2s ease; position: relative; }
    .jd-scan-highlight--matched { background-color: #d1fae5 !important; border: 1px solid #05966960 !important; }
    .jd-scan-highlight--unmatched { background-color: #fee2e2 !important; border: 1px solid #dc262660 !important; }
    .jd-scan-highlight:hover { transform: scale(1.05); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); z-index: 10; }
    @media (prefers-color-scheme: dark) {
      .jd-scan-highlight--matched { background-color: #064e3b !important; border-color: #10b981 !important; }
      .jd-scan-highlight--unmatched { background-color: #7f1d1d !important; border-color: #f87171 !important; }
    }
    @keyframes jd-scan-highlight-appear { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    .jd-scan-highlight { animation: jd-scan-highlight-appear 0.3s ease-out; }
  `;
  (document.head ?? document.documentElement).appendChild(styleElement);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  if (typeof document === 'undefined') {
    // Fallback for environments without DOM
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create a highlight span element
 */
function createHighlightSpan(
  text: string, 
  isMatched: boolean, 
  config: HighlightConfig
): string {
  const color = isMatched ? config.matchedColor : config.unmatchedColor;
  const bgColor = isMatched ? config.matchedBgColor : config.unmatchedBgColor;
  const title = isMatched ? 'Matched keyword' : 'Missing keyword';
  
  return `<span class="${config.className} ${config.className}--${isMatched ? 'matched' : 'unmatched'}" 
    style="background-color: ${bgColor}; padding: 1px 3px; border-radius: 3px; border: 1px solid ${color}40;" 
    title="${title}: ${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}

/**
 * Create a highlight span DOM element
 */
function createHighlightSpanElement(
  text: string,
  isMatched: boolean,
  config: HighlightConfig
): HTMLElement {
  const span = document.createElement('span');
  span.textContent = text;
  span.className = `${config.className} ${config.className}--${isMatched ? 'matched' : 'unmatched'}`;
  
  const color = isMatched ? config.matchedColor : config.unmatchedColor;
  const bgColor = isMatched ? config.matchedBgColor : config.unmatchedBgColor;
  
  span.style.backgroundColor = bgColor;
  span.style.padding = '1px 3px';
  span.style.borderRadius = '3px';
  span.style.border = `1px solid ${color}40`;
  span.title = `${isMatched ? 'Matched keyword' : 'Missing keyword'}: ${text}`;
  
  return span;
}

/**
 * Highlight keywords in text based on ATS scan results
 * This version returns an HTML string and is destructive if used with innerHTML
 */
export function highlightKeywords(
  jobDescriptionText: string,
  resumeContent: string,
  config: HighlightConfig = DEFAULT_HIGHLIGHT_CONFIG
): HighlightResult {
  // Get ATS scan results
  const scanResult = scanResume(resumeContent, jobDescriptionText);
  
  // Use the keywords identified by ATS scanner
  const matchedKeywords = new Set(scanResult.matchedKeywords.map(k => k.toLowerCase()));
  const missingKeywords = new Set(scanResult.missingKeywords.map(k => k.toLowerCase()));
  const allKeywords = [...scanResult.matchedKeywords, ...scanResult.missingKeywords];
  
  let highlightedText = jobDescriptionText;
  
  // Sort keywords by length (longest first) to avoid partial replacements
  const sortedKeywords = allKeywords.sort((a, b) => b.length - a.length);
  
  // Track already highlighted positions to avoid double highlighting
  const highlightedRanges: Array<{start: number, end: number}> = [];
  
  sortedKeywords.forEach(keyword => {
    const isMatched = matchedKeywords.has(keyword.toLowerCase());
    
    // Create regex for case-insensitive whole word matching
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex: RegExp;
    
    // For short keywords or those with special chars, use simple contains matching
    if (keyword.length < 3 || /[.#+]/.test(keyword)) {
      regex = new RegExp(`(${escapedKeyword})`, 'gi');
    } else {
      regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi');
    }
    
    // Find all matches
    let match;
    const matches: Array<{index: number, length: number, text: string}> = [];
    
    while ((match = regex.exec(highlightedText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      
      // Check if this range overlaps with already highlighted ranges
      const overlaps = highlightedRanges.some(range => 
        (start >= range.start && start < range.end) || 
        (end > range.start && end <= range.end) ||
        (start <= range.start && end >= range.end)
      );
      
      if (!overlaps) {
        matches.push({
          index: start,
          length: match[0].length,
          text: match[0]
        });
      }
    }
    
    // Apply highlights in reverse order to maintain indices
    matches.reverse().forEach(matchInfo => {
      const before = highlightedText.substring(0, matchInfo.index);
      const after = highlightedText.substring(matchInfo.index + matchInfo.length);
      const highlighted = createHighlightSpan(matchInfo.text, isMatched, config);
      
      highlightedText = before + highlighted + after;
      
      // Track this highlighted range (adjust for HTML insertion)
      highlightedRanges.push({
        start: matchInfo.index,
        end: matchInfo.index + highlighted.length
      });
    });
  });
  
  return {
    highlightedHtml: highlightedText,
    stats: {
      totalKeywords: allKeywords.length,
      matchedCount: matchedKeywords.size,
      unmatchedCount: missingKeywords.size
    }
  };
}

/**
 * Apply highlighting directly to DOM elements safely (preserving structure)
 */
export function highlightInDOM(
  targetElement: Element,
  resumeContent: string,
  config: HighlightConfig = DEFAULT_HIGHLIGHT_CONFIG
): HighlightResult {
  if (!targetElement || typeof document === 'undefined') {
    throw new Error('DOM element and document are required for highlighting');
  }
  
  // 1. Scan the full text content to identify keywords
  const originalText = targetElement.textContent || '';
  const scanResult = scanResume(resumeContent, originalText);
  
  const matchedKeywords = new Set(scanResult.matchedKeywords.map(k => k.toLowerCase()));
  const missingKeywords = new Set(scanResult.missingKeywords.map(k => k.toLowerCase()));
  const allKeywords = [...scanResult.matchedKeywords, ...scanResult.missingKeywords];
  
  // Sort keywords by length (longest first)
  const sortedKeywords = allKeywords.sort((a, b) => b.length - a.length);

  // 2. Find all text nodes in the element
  const textNodes: Text[] = [];
  const treeWalker = document.createTreeWalker(
    targetElement,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip nodes that are already highlighted
        if (node.parentElement?.classList.contains(config.className || 'jd-scan-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip script and style tags
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement?.tagName || '')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  while (treeWalker.nextNode()) {
    textNodes.push(treeWalker.currentNode as Text);
  }

  // 3. Process each text node
  textNodes.forEach(node => {
    const text = node.textContent || '';
    if (!text.trim()) return;

    // Find all matches in this text node
    const matches: Array<{start: number, end: number, text: string, isMatched: boolean}> = [];

    sortedKeywords.forEach(keyword => {
      const isMatched = matchedKeywords.has(keyword.toLowerCase());
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let regex: RegExp;
      
      if (keyword.length < 3 || /[.#+]/.test(keyword)) {
        regex = new RegExp(`(${escapedKeyword})`, 'gi');
      } else {
        regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi');
      }

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          isMatched
        });
      }
    });

    if (matches.length === 0) return;

    // Sort matches by start position, then by length (descending) to prefer longer matches
    matches.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return (b.end - b.start) - (a.end - a.start);
    });

    // Filter overlapping matches (prioritize earlier matches, then longer ones)
    const filteredMatches: typeof matches = [];
    let lastEnd = 0;

    matches.forEach(m => {
      if (m.start >= lastEnd) {
        filteredMatches.push(m);
        lastEnd = m.end;
      }
    });

    if (filteredMatches.length === 0) return;

    // Build the fragment
    const fragment = document.createDocumentFragment();
    let cursor = 0;

    filteredMatches.forEach(m => {
      // Text before match
      if (m.start > cursor) {
        fragment.appendChild(document.createTextNode(text.substring(cursor, m.start)));
      }
      
      // Match element
      fragment.appendChild(createHighlightSpanElement(m.text, m.isMatched, config));
      
      cursor = m.end;
    });

    // Text after last match
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(cursor)));
    }

    // Replace the text node with the fragment
    node.parentNode?.replaceChild(fragment, node);
  });
  
  return {
    highlightedHtml: targetElement.innerHTML,
    stats: {
      totalKeywords: allKeywords.length,
      matchedCount: matchedKeywords.size,
      unmatchedCount: missingKeywords.size
    }
  };
}

/**
 * Remove all highlighting from a DOM element
 */
export function removeHighlighting(targetElement: Element): void {
  if (!targetElement || typeof document === 'undefined') {
    return;
  }
  
  // Find all highlight spans and replace with their text content
  const highlightSpans = targetElement.querySelectorAll(`.${DEFAULT_HIGHLIGHT_CONFIG.className}`);
  highlightSpans.forEach(span => {
    const textNode = document.createTextNode(span.textContent || '');
    span.parentNode?.replaceChild(textNode, span);
  });
  
  // Normalize text nodes to merge adjacent ones
  targetElement.normalize();
}

/**
 * Toggle highlighting on/off for a DOM element
 */
export function toggleHighlighting(
  targetElement: Element,
  resumeContent: string,
  config: HighlightConfig = DEFAULT_HIGHLIGHT_CONFIG
): { isHighlighted: boolean; result?: HighlightResult } {
  const hasHighlights = targetElement.querySelector(`.${config.className || 'jd-scan-highlight'}`) !== null;
  
  if (hasHighlights) {
    removeHighlighting(targetElement);
    return { isHighlighted: false };
  } else {
    const result = highlightInDOM(targetElement, resumeContent, config);
    return { isHighlighted: true, result };
  }
}

/**
 * Create a floating highlight toggle button
 */
export function createHighlightToggleButton(
  onToggle: (isHighlighted: boolean) => void,
  initialState: boolean = false
): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('Document is required to create toggle button');
  }
  
  const button = document.createElement('button');
  button.className = 'jd-scan-highlight-toggle';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: all 0.2s ease;
  `;
  
  const updateButton = (isHighlighted: boolean) => {
    button.textContent = isHighlighted ? '🔍 Hide Highlights' : '🔍 Show Highlights';
    button.style.background = isHighlighted ? '#dc2626' : '#3b82f6';
  };
  
  updateButton(initialState);
  
  button.addEventListener('click', () => {
    const newState = !button.textContent?.includes('Hide');
    updateButton(newState);
    onToggle(newState);
  });
  
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });
  
  return button;
}
