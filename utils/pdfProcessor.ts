import * as pdfjs from 'pdfjs-dist';

// Setup for PDF.js - we initialize the worker URL here, but only when needed
// to avoid initialization loops in the extension context.

/**
 * Extract text from a PDF file using pdfjs-dist.
 */
export async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
    console.log('[PDF Processor] Starting extraction...');

    // Set worker source only when needed, and use a fallback check
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        try {
            // Try to use the bundled worker from the public directory
            pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
        } catch (e) {
            console.error('[PDF Processor] Failed to set worker source:', e);
            // If the extension context is invalid, setting it to empty might trigger the fake worker
            pdfjs.GlobalWorkerOptions.workerSrc = '';
        }
    }

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });

    console.log('[PDF Processor] Loading document...');
    const pdf = await loadingTask.promise;
    console.log(`[PDF Processor] Document loaded. Pages: ${pdf.numPages}`);

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`[PDF Processor] Processing page ${i}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => (item as any).str || '')
            .join(' ');
        fullText += pageText + '\n';
    }

    console.log(`[PDF Processor] Extraction complete. Characters extracted: ${fullText.length}`);
    console.log(`[PDF Processor] First 200 chars: "${fullText.substring(0, 200)}"`);

    return fullText;
}
