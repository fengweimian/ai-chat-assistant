const CONSTANTS = require('../shared/constants');

class ApiClient {
  constructor() {
    this.baseUrl = CONSTANTS.DEFAULT_API_BASE;
    this.apiKey = CONSTANTS.DEFAULT_API_KEY;
  }

  configure(baseUrl, apiKey) {
    if (baseUrl) this.baseUrl = baseUrl;
    if (apiKey) this.apiKey = apiKey;
  }

  buildModelName(baseModel, thinkingLevel) {
    if (thinkingLevel && thinkingLevel !== 'none') {
      return `${baseModel}-${thinkingLevel}`;
    }
    return baseModel;
  }

  buildSystemPrompt(settings) {
    let prompt = CONSTANTS.SYSTEM_PROMPT_BASE + '\n' + CONSTANTS.SYSTEM_PROMPT_PPT;
    if (settings.webSearch) {
      prompt += '\n' + CONSTANTS.SYSTEM_PROMPT_WEB_SEARCH;
    }
    return prompt;
  }

  buildMessages(conversation) {
    const messages = [];
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(conversation.settings)
    });

    for (const msg of conversation.messages) {
      if (msg.role === 'user') {
        if (msg.images && msg.images.length > 0) {
          const content = [{ type: 'text', text: msg.content }];
          for (const img of msg.images) {
            content.push({
              type: 'image_url',
              image_url: { url: img }
            });
          }
          messages.push({ role: 'user', content });
        } else {
          messages.push({ role: 'user', content: msg.content });
        }
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    return messages;
  }

  async streamChat(conversation, userContent, images, onChunk, onDone, onError) {
    const settings = conversation.settings;
    const model = this.buildModelName(settings.model || CONSTANTS.DEFAULT_MODEL, settings.thinkingLevel);

    const tempConv = {
      ...conversation,
      messages: [...conversation.messages, { role: 'user', content: userContent, images }]
    };
    const messages = this.buildMessages(tempConv);

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: settings.temperature || CONSTANTS.DEFAULT_TEMPERATURE,
          max_tokens: settings.maxTokens || CONSTANTS.DEFAULT_MAX_TOKENS
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        onError(`API Error (${response.status}): ${errorText}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onChunk(delta.content);
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }

      onDone(fullContent);
    } catch (e) {
      onError(`Network error: ${e.message}`);
    }
  }
}

module.exports = ApiClient;
