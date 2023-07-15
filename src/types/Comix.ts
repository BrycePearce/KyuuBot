// errors
export type ComixApiError = {
  message: string;
  type: 'apiError';
};

export type ComixNotFoundError = {
  message: string;
  type: 'chapterNotFound';
  emotePath: string;
};

export type ComixError = ComixApiError | ComixNotFoundError;
