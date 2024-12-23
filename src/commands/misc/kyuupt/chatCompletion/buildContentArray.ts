interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image_url';
  image_url: { url: string };
}

export type OpenAIContent = TextContent | ImageContent;

export function buildContentArray(userPrompt: string, imageUrls: string[]): OpenAIContent[] {
  const contentArray: OpenAIContent[] = [];

  if (userPrompt.trim().length > 0) {
    contentArray.push({
      type: 'text',
      text: userPrompt,
    });
  }

  imageUrls.forEach((imgUrl) => {
    contentArray.push({
      type: 'image_url',
      image_url: { url: imgUrl },
    });
  });

  return contentArray;
}
