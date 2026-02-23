/**
 * Simple ATS (Applicant Tracking System) Scanner
 * Performs keyword-based matching without AI
 */

export interface ATSResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  totalKeywords: number;
  matchPercentage: number;
}

/**
 * Extract keywords from job description
 */
export function extractKeywords(text: string): string[] {
  // Common stop words to ignore
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'our', 'your'
  ]);

  // Extract words and phrases
  const words = text
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Extract multi-word technical terms (e.g., "machine learning", "react.js")
  const phrases: string[] = [];
  const techPatterns = [
    /\b(react|vue|angular|node|python|java|javascript|typescript|sql|nosql|aws|azure|gcp|docker|kubernetes|git|agile|scrum)\b/gi,
    /\b([a-z]+\.js|[a-z]+\.py|[a-z]+\+\+)\b/gi,
    /\b([a-z]+ [a-z]+ing)\b/gi, // e.g., "machine learning"
  ];

  techPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase()));
    }
  });

  // Combine and deduplicate
  const allKeywords = [...new Set([...words, ...phrases])];
  
  // Sort by frequency (most common first)
  const frequency = new Map<string, number>();
  allKeywords.forEach(keyword => {
    const count = (text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
    frequency.set(keyword, count);
  });

  return allKeywords
    .sort((a, b) => (frequency.get(b) || 0) - (frequency.get(a) || 0))
    .slice(0, 50); // Top 50 keywords
}

/**
 * Check if resume contains keyword (case-insensitive, whole word match)
 */
function containsKeyword(resume: string, keyword: string): boolean {
  const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(resume);
}

/**
 * Scan resume against job description
 */
export function scanResume(resumeContent: string, jobDescription: string): ATSResult {
  const jdKeywords = extractKeywords(jobDescription);
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  // Check each keyword
  jdKeywords.forEach(keyword => {
    if (containsKeyword(resumeContent, keyword)) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  });

  // Calculate score
  const totalKeywords = jdKeywords.length;
  const matchPercentage = totalKeywords > 0 
    ? Math.round((matchedKeywords.length / totalKeywords) * 100) 
    : 0;

  // Generate suggestions
  const suggestions: string[] = [];
  const topMissing = missingKeywords.slice(0, 5);
  
  if (matchPercentage < 60) {
    suggestions.push(`Add ${topMissing.length} key skills: ${topMissing.join(', ')}`);
  }
  if (matchPercentage >= 60 && matchPercentage < 80) {
    suggestions.push('Good match! Consider adding: ' + topMissing.slice(0, 3).join(', '));
  }
  if (matchPercentage >= 80) {
    suggestions.push('Excellent match! Your resume aligns well with the job requirements.');
  }

  return {
    score: matchPercentage,
    matchedKeywords,
    missingKeywords,
    suggestions,
    totalKeywords,
    matchPercentage,
  };
}

/**
 * Scan multiple resumes
 */
export function scanMultipleResumes(
  resumes: Array<{ id: string; content: string }>,
  jobDescription: string
): Array<ATSResult & { resumeId: string }> {
  return resumes.map(resume => ({
    resumeId: resume.id,
    ...scanResume(resume.content, jobDescription),
  }));
}
