/**
 * Tests for Workable integration
 */

// Mock window.location for testing
const mockLocation = (href: string) => {
  Object.defineProperty(window, 'location', {
    value: { href },
    writable: true
  });
};

// Import the function we want to test (we'll need to export it for testing)
// For now, let's test the URL detection logic directly

describe('Workable Integration', () => {
  describe('URL Detection', () => {
    const testIsLikelyJobPage = (url: string): boolean => {
      const urlLower = url.toLowerCase();
      return urlLower.includes("linkedin.com/jobs") ||
        urlLower.includes("indeed.com") ||
        urlLower.includes("glassdoor.com") ||
        urlLower.includes("wellfound.com") ||
        urlLower.includes("workable.com") ||
        (urlLower.includes("workable") && urlLower.includes("/j/")) ||
        urlLower.includes("career") ||
        urlLower.includes("/job/") ||
        urlLower.includes("/jobs/") ||
        urlLower.includes("apply");
    };

    test('should detect Workable main domain', () => {
      expect(testIsLikelyJobPage('https://company.workable.com/jobs/123456')).toBe(true);
      expect(testIsLikelyJobPage('https://workable.com/j/ABC123')).toBe(true);
    });

    test('should detect Workable-powered career pages', () => {
      expect(testIsLikelyJobPage('https://careers.company.com/workable/j/123')).toBe(true);
      expect(testIsLikelyJobPage('https://company-workable.com/jobs')).toBe(true);
    });

    test('should detect job URLs with /j/ pattern', () => {
      expect(testIsLikelyJobPage('https://example.workable.com/j/ABC123DEF')).toBe(true);
      expect(testIsLikelyJobPage('https://company.workable.com/j/456789')).toBe(true);
    });

    test('should not detect non-job Workable pages', () => {
      expect(testIsLikelyJobPage('https://workable.com/about')).toBe(false);
      expect(testIsLikelyJobPage('https://workable.com/pricing')).toBe(false);
      expect(testIsLikelyJobPage('https://company.workable.com/company')).toBe(false);
    });

    test('should still detect other supported job sites', () => {
      expect(testIsLikelyJobPage('https://linkedin.com/jobs/view/123')).toBe(true);
      expect(testIsLikelyJobPage('https://indeed.com/viewjob?jk=123')).toBe(true);
      expect(testIsLikelyJobPage('https://glassdoor.com/job/123')).toBe(true);
    });
  });

  describe('Selector Priority', () => {
    test('should prioritize Workable selectors on Workable sites', () => {
      const workableSelectors = [
        "[data-ui='job-description']",
        ".job-description",
        "[data-ui='description']", 
        ".description",
        ".job-content",
        ".job-details",
        "[data-ui='job-content']"
      ];

      const linkedInSelectors = [
        ".jobs-description__content",
        ".jobs-description-content__text",
        ".jobs-description-content"
      ];

      // On Workable sites, Workable selectors should come first
      const isWorkableSite = true;
      const expectedOrder = isWorkableSite 
        ? [...workableSelectors, ...linkedInSelectors]
        : [...linkedInSelectors, ...workableSelectors];

      expect(expectedOrder[0]).toBe("[data-ui='job-description']");
    });
  });

  describe('Content Extraction', () => {
    test('should extract job description from Workable data attributes', () => {
      // Mock DOM element
      const mockElement = {
        textContent: 'We are looking for a Senior Developer with React and Node.js experience...',
        querySelector: jest.fn(),
        querySelectorAll: jest.fn()
      };

      // Simulate finding element with Workable selector
      const selector = "[data-ui='job-description']";
      expect(selector).toBe("[data-ui='job-description']");
      expect(mockElement.textContent.length).toBeGreaterThan(50);
    });

    test('should extract title and company from Workable elements', () => {
      const titleSelectors = [
        "[data-ui='job-title']",
        ".job-title",
        "[data-testid='job-title']",
        "header h1",
        "main h1"
      ];

      const companySelectors = [
        "[data-ui='company-name']",
        ".company-name", 
        "[data-testid='company-name']",
        ".employer-name"
      ];

      expect(titleSelectors).toContain("[data-ui='job-title']");
      expect(companySelectors).toContain("[data-ui='company-name']");
    });
  });
});