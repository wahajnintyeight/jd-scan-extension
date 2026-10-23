import { createLLMChatCompletion } from './api';
import { confirmedNameAnswer, requiresConfirmedName, type ApplicationName } from './applicationName';
import { buildApplicationFormMessages, parseApplicationFormAnswers, type ParsedApplicationFormAnswers } from './llmAgent';
import type { ApplicationFormField } from '../components/sidepanel/types';

export async function draftApplicationAnswers(configId: string, input: {
  resume: string; jobDescription: string; jobTitle?: string; company?: string;
  fields: ApplicationFormField[]; applicationName?: ApplicationName;
}): Promise<ParsedApplicationFormAnswers> {
  const answers: ParsedApplicationFormAnswers['answers'] = [];
  const pending: ApplicationFormField[] = [];
  const manualNameIds: string[] = [];
  for (const field of input.fields) {
    const value = confirmedNameAnswer(field, input.applicationName);
    if (value) answers.push({ fieldId: field.id, value });
    else if (requiresConfirmedName(field) && !input.applicationName) manualNameIds.push(field.id);
    else pending.push(field);
  }
  if (!pending.length) return { answers, needsUserIds: manualNameIds };
  const result = await createLLMChatCompletion(configId, buildApplicationFormMessages({ ...input, fields: pending }));
  if (!result.success || !result.text) throw new Error(result.error || 'The selected provider could not draft answers.');
  const parsed = parseApplicationFormAnswers(result.text, pending);
  return { answers: [...answers, ...parsed.answers], needsUserIds: [...parsed.needsUserIds, ...manualNameIds] };
}
