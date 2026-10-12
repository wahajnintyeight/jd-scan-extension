export interface JobData {
  jd: string;
  title: string;
  company: string;
}

export interface Resume {
  id: string;
  name: string;
  content: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  selected: boolean;
}

export interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

export interface ScanResult {
  resumeId: string;
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

export interface ApplicationFormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'search' | 'textarea' | 'select';
  autocomplete?: string;
  value: string;
  required?: boolean;
  requiresUserAction?: boolean;
  maxLength?: number;
  options?: Array<{ label: string; value: string }>;
}
