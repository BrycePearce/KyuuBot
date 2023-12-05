export interface SDTextToImg {
  status: string;
  tip: string;
  generationTime: number;
  id: number;
  output: string[];
  proxy_links: string;
  nsfw_content_detected: string;
  meta: Meta;
}

export interface Meta {
  H: number;
  W: number;
  enable_attention_slicing: string;
  file_prefix: string;
  guidance_scale: number;
  instant_response: string;
  model: string;
  n_samples: number;
  negative_prompt: string;
  outdir: string;
  prompt: string;
  revision: string;
  safetychecker: string;
  seed: number;
  steps: number;
  vae: string;
}
