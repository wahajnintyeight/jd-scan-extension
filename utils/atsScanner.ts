/**
 * Enhanced ATS (Applicant Tracking System) Scanner
 * Performs sophisticated keyword-based matching with section weighting and semantic awareness
 */

export interface ATSResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  totalKeywords: number;
  matchPercentage: number;
  details: {
    hardSkillsMatch: number;
    softSkillsMatch: number;
    titleMatch: boolean;
    sectionCoverage: string[];
  };
}

// Common job titles and their synonyms for title matching
const TITLE_SYNONYMS: Record<string, string[]> = {
  'software engineer': ['software developer', 'application developer', 'programmer', 'coder', 'full stack developer'],
  'administrative assistant': ['executive assistant', 'office coordinator', 'office manager', 'clerk'],
  'marketing manager': ['brand manager', 'growth lead', 'marketing director'],
  'project manager': ['program manager', 'project lead', 'coordinator'],
  'data scientist': ['data analyst', 'machine learning engineer', 'ai researcher'],
};

// Map of common keywords to their synonyms/related terms to improve match rates
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'javascript': ['js', 'es6', 'ecmascript', 'frontend developer'],
  'typescript': ['ts'],
  'react': ['reactjs', 'react.js', 'frontend'],
  'node': ['nodejs', 'node.js', 'backend'],
  'sql': ['mysql', 'postgresql', 't-sql', 'relational database', 'database'],
  'agile': ['scrum', 'kanban', 'sprints', 'sdlc'],
  'aws': ['amazon web services', 'ec2', 's3', 'lambda', 'cloud'],
  'machine learning': ['ml', 'deep learning', 'artificial intelligence', 'ai'],
  'project management': ['pm', 'pmp', 'project coordination'],
  'communication': ['interpersonal skills', 'verbal communication', 'written communication', 'fluent'],
  'leadership': ['management', 'mentoring', 'team lead', 'spearheaded'],
  'php': ['laravel', 'symfony', 'codeigniter'],
  'python': ['django', 'flask', 'fastapi'],
};

/**
 * Extract keywords from job description with higher-fidelity parsing
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
    'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'our', 'your', 'experience', 'years'
  ]);

  const cleanText = text.toLowerCase().replace(/[^\w\s+#.-]/g, ' ');

  // 1. Extract N-grams (2-3 word phrases) first
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  const phrases: string[] = [];

  // Extract Bigrams (e.g., "project management", "machine learning")
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (Object.keys(KEYWORD_SYNONYMS).includes(bigram) || /learning|development|engineer|architect/.test(bigram)) {
      phrases.push(bigram);
    }
  }

  // 2. Extract Single Tech Keywords
  const techPatterns = [
    /\b(react|vue|angular|node|python|java|javascript|typescript|sql|nosql|aws|azure|gcp|docker|kubernetes|git|agile|scrum|rust|golang|ruby|php|swift|kotlin|flutter|dart)\b/gi,
    /\b([a-z]+\.js|[a-z]+\.py|[a-z]+\+\+)\b/gi,
    /\b(ui\/ux|aws|seo|sem|crm|erp|saas|paas|iaas)\b/gi
  ];

  techPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase()));
    }
  });

  // 3. Regular words
  const regularWords = words.filter(word => word.length > 2 && !stopWords.has(word));

  const allKeywords = [...new Set([...phrases, ...regularWords])];

  // 4. Frequency-based ranking
  const frequency = new Map<string, number>();
  allKeywords.forEach(keyword => {
    const count = (text.toLowerCase().split(keyword).length - 1);
    frequency.set(keyword, count);
  });

  return allKeywords
    .sort((a, b) => (frequency.get(b) || 0) - (frequency.get(a) || 0))
    .slice(0, 40);
}

/**
 * Check match with synonym support
 */
function checkMatch(content: string, keyword: string): boolean {
  const contentLower = content.toLowerCase();
  const synonyms = KEYWORD_SYNONYMS[keyword] || [];
  const searchTerms = [keyword, ...synonyms];

  return searchTerms.some(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // If the term is very short or contains special characters like '.', '+', '#', 
    // we don't use strict \b boundaries which can fail in many edge cases
    if (term.length < 3 || /[.#+]/.test(term)) {
      return contentLower.includes(term.toLowerCase());
    }
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(contentLower);
  });
}

/**
 * Scan resume against job description using advanced heuristics
 */
export function scanResume(resumeContent: string, jobDescription: string): ATSResult {
  const jdKeywords = extractKeywords(jobDescription);
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  // Categorize keywords (Approximation)
  const hardSkillsList = ['javascript', 'typescript', 'python', 'java', 'sql', 'aws', 'react', 'node', 'docker', 'kubernetes', 'git', 'php', 'laravel', 'html', 'css'];
  let hardSkillsCount = 0;
  let hardSkillsMatched = 0;

  jdKeywords.forEach(keyword => {
    const isHardSkill = hardSkillsList.some(s => keyword.toLowerCase().includes(s.toLowerCase()));
    if (isHardSkill) hardSkillsCount++;

    if (checkMatch(resumeContent, keyword)) {
      matchedKeywords.push(keyword);
      if (isHardSkill) hardSkillsMatched++;
    } else {
      missingKeywords.push(keyword);
    }
  });

  // Section Analysis
  const sections = ['experience', 'education', 'skills', 'summary', 'projects', 'contact'];
  const detectedSections = sections.filter(s =>
    new RegExp(`\\b${s}\\b`, 'i').test(resumeContent)
  );

  // Score calculation with weighting
  const keywordScore = jdKeywords.length > 0 ? (matchedKeywords.length / jdKeywords.length) : 0;
  const hardSkillScore = hardSkillsCount > 0 ? (hardSkillsMatched / hardSkillsCount) : keywordScore;
  const sectionWeight = detectedSections.length / sections.length;

  // Final Match Score (40% Keywords, 40% Hard Skills, 20% Formatting/Sections)
  const finalScore = Math.round(
    ((keywordScore * 0.4) + (hardSkillScore * 0.4) + (sectionWeight * 0.2)) * 100
  );

  // Suggestions
  const suggestions: string[] = [];
  if (detectedSections.length < 3) suggestions.push("Improve resume structure by adding clear headings (Experience, Skills, Education)");

  const topMissing = missingKeywords.slice(0, 5);
  if (topMissing.length > 0) {
    suggestions.push(`Integrate missing keywords: ${topMissing.join(', ')}`);
  }

  if (finalScore < 70) {
    suggestions.push("Tailor your 'Experience' descriptions to match the job requirements more closely.");
  }

  return {
    score: finalScore,
    matchedKeywords,
    missingKeywords,
    suggestions: [...new Set(suggestions)],
    totalKeywords: jdKeywords.length,
    matchPercentage: finalScore,
    details: {
      hardSkillsMatch: Math.round(hardSkillScore * 100),
      softSkillsMatch: Math.round(keywordScore * 100), // Simplified
      titleMatch: false, // Could be improved with title extraction
      sectionCoverage: detectedSections,
    }
  };
}

export function scanMultipleResumes(
  resumes: Array<{ id: string; content: string }>,
  jobDescription: string
): Array<ATSResult & { resumeId: string }> {
  return resumes.map(resume => ({
    resumeId: resume.id,
    ...scanResume(resume.content, jobDescription),
  }));
}
