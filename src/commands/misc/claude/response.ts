import type { Message } from '@anthropic-ai/sdk/resources/messages';
import Anthropic from '@anthropic-ai/sdk';

export function readClaudeError(error: unknown): string {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return '🙀 Claude took too long to respond. Please try again.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return '🙀 I couldn’t connect to Claude. Please try again in a moment.';
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429) return '🙀 Claude is receiving too many requests. Please try again in a moment.';
    if (error.status >= 500) return '🙀 Claude is temporarily unavailable. Please try again in a moment.';
    if (error.status === 400 || error.status === 413) {
      return '🙀 Claude couldn’t process this request. Try a shorter question or a different image.';
    }
  }
  return '🙀 I couldn’t complete your Claude request. Please try again.';
}

export function readClaudeResponse(message: Pick<Message, 'content' | 'stop_reason'>): string {
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (text) return text;
  if (message.stop_reason === 'refusal') {
    return '🙀 Claude declined to answer this request. Its safety filter can sometimes flag harmless questions.';
  }
  return '';
}
