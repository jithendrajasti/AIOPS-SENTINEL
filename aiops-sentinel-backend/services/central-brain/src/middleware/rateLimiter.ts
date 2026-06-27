import rateLimit from 'express-rate-limit';

// Applied to POST /api/resolution — prevents accidental or malicious
// Golden Record flooding which would inflate Pinecone storage and OpenAI costs.
export const resolutionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute sliding window
  limit: 20,                  // max 20 submissions per IP per window
  standardHeaders: 'draft-7', // emits RateLimit-Policy header (RFC-compliant)
  legacyHeaders: false,
  message: {
    error: 'Too many resolution submissions from this IP — please wait before trying again.',
  },
});
