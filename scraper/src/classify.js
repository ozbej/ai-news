const SI_PATTERNS = [
  /super\s?intelligen/i, /\bASI\b/, /\bAGI\b/, /artificial general intelligence/i,
  /\balignment\b/i, /\bsingularity\b/i, /recursive self[- ]improvement/i,
  /\bx-risk\b/i, /existential risk/i, /intelligence explosion/i, /frontier safety/i,
];
const AI_PATTERNS = [
  /\bAI\b/, /artificial intelligence/i, /machine learning/i, /\bLLMs?\b/,
  /language model/i, /neural network/i, /deep learning/i, /\bGPT/i,
  /\bClaude\b/, /\bGemini\b/, /\bLlama\b/i, /transformer/i, /diffusion/i,
];

export const isAiRelated = (text) => AI_PATTERNS.some((r) => r.test(text)) || SI_PATTERNS.some((r) => r.test(text));

export function classify(text, hint) {
  if (SI_PATTERNS.some((r) => r.test(text))) return 'si';
  return hint === 'si' && isAiRelated(text) ? 'si' : 'ai';
}
