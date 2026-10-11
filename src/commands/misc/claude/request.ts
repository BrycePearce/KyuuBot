import type { ContentBlockParam, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { CHAT_MODELS } from '../../../utils/chatModels';

// An explicit timeout also permits larger non-streaming responses in the SDK.
export const CLAUDE_REQUEST_TIMEOUT_MS = 180_000;

export function buildClaudeRequest(content: ContentBlockParam[]): MessageCreateParamsNonStreaming {
  return {
    model: CHAT_MODELS.claude,
    system:
      'You are a helpful assistant. Your response should be 80 words or less, unless necessary for a full answer.',
    messages: [{ role: 'user', content }],
    // Thinking and visible text share this limit; a short answer still needs reasoning headroom.
    max_tokens: 32768,
    thinking: { type: 'adaptive', display: 'omitted' },
    output_config: { effort: 'high' },
  };
}
