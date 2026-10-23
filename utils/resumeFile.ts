import { extractTextFromPDF } from './pdfProcessor';

export async function readResumeFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Resume files must be 10 MB or smaller.');
  const extension = file.name.toLowerCase().split('.').pop();
  let content: string;
  if (extension === 'txt' || (!extension && file.type === 'text/plain')) content = await file.text();
  else if (extension === 'pdf' || (!extension && file.type === 'application/pdf')) content = await extractTextFromPDF(await file.arrayBuffer());
  else throw new Error('Upload a PDF or TXT resume. Export Word documents as PDF first.');
  content = content.trim();
  if (!content) throw new Error('No readable text found. Use a text-based PDF or TXT resume.');
  if (content.length > 200000) throw new Error('This resume contains too much text. Upload a shorter version.');
  return content;
}
