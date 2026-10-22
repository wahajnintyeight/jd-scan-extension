import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ConnectionTestResultProps {
  result: { success: boolean; message: string };
}

export default function ConnectionTestResult({ result }: ConnectionTestResultProps) {
  let message = result.message;
  if (!result.success) {
    if (/Config\.APIKeys|Field validation for 'APIKeys'/i.test(message)) {
      message = 'The API rejected the key format. Paste the complete API key for the selected provider.';
    } else if (/openrouter and scaleway fallback failed/i.test(message) && /\b403\b/.test(message)) {
      message = 'OpenRouter could not complete the test. The fallback provider also denied access (HTTP 403).';
    } else if (/\b403\b|forbidden|insufficient permissions/i.test(message)) {
      message = 'Access was denied during the connection test (403). Check your API key’s permissions and access to this model.';
    } else if (/\bHTTP 503\b/i.test(message)) {
      message = 'The connection-test service is unavailable (HTTP 503). Try again shortly.';
    }
  }

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl text-sm font-medium flex items-start gap-3 ${result.success
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-200 dark:border-emerald-800'
        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-2 border-amber-200 dark:border-amber-800'
      }`}
    >
      {result.success
        ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
        : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{result.success ? 'Connection Successful!' : 'Connection Failed'}</p>
        <p className="text-xs mt-1 opacity-90 whitespace-pre-wrap break-words">{message}</p>
        {message !== result.message && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer font-semibold">Technical details</summary>
            <p className="mt-2 opacity-90 whitespace-pre-wrap break-words">{result.message}</p>
          </details>
        )}
      </div>
    </motion.div>
  );
}
