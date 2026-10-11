import OpenAI from 'openai';
import { CHAT_MODELS } from '../../../../utils/chatModels';
import { OpenAIContent } from './buildContentArray';

export class ChatResponseError extends Error {}

export async function requestChatAnswer(client: OpenAI, content: OpenAIContent[]): Promise<string> {
  const response = await client.chat.completions.create(
    {
      model: CHAT_MODELS.openai,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that can interpret both text and images. Provide concise, accurate responses.',
        },
        { role: 'user', content },
      ],
      // Astra requires reasoning. Its budget includes thinking and the visible answer.
      reasoning_effort: 'high',
      max_completion_tokens: 32768,
    },
    { timeout: 180_000 }
  );
  const choice = response.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new ChatResponseError('The answer reached its response limit. Please try a narrower question.');
  }
  const text = (choice?.message.content ?? choice?.message.refusal)?.trim();
  if (!text) throw new ChatResponseError('I did not get an answer back. Please try again.');
  return text;
}

export function readChatError(error: unknown): string {
  if (error instanceof ChatResponseError) return error.message;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return 'The answer took too long. Please try again.';
  if (error instanceof OpenAI.APIError && error.status === 429)
    return 'OpenAI is busy or its usage limit was reached. Please try again later.';
  return 'I could not generate an answer right now. Please try again later.';
}
