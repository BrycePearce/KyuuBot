export interface DreamboothResponse {
  generationTime: number;
  id: number;
  meta: Meta;
  nsfw_content_detected: boolean;
  output: string[];
  proxy_links: string[];
  status: string;
  tip: string;
  webhook_status: string;
}

export interface DreamboothRetry {
  status: string;
  id: number;
  output: string[];
}

export interface Meta {
  H: number;
  W: number;
  algorithm_type: string;
  base64: string;
  clip_skip: number;
  embeddings: null;
  file_prefix: string;
  free_u: string;
  full_url: string;
  guidance_scale: number;
  instant_response: string;
  lora: null;
  lora_strength: number;
  model_id: string;
  multi_lingual: string;
  n_samples: number;
  negative_prompt: string;
  panorama: string;
  prompt: string;
  safety_checker: string;
  safety_checker_type: string;
  scheduler: string;
  seed: number;
  self_attention: string;
  steps: number;
  temp: string;
  tomesd: string;
  upscale: string;
  use_karras_sigmas: string;
  vae: null;
}
