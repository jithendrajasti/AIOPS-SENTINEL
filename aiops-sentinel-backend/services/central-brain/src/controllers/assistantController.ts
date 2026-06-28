import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getPool } from '../config/database';
import OpenAI from 'openai';

export const assistantRouter = Router();

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const CHAT_MODEL = process.env.NVIDIA_MODEL ?? 'deepseek-ai/deepseek-v4-flash';

type IncidentRow = {
  code: string; title: string; service: string; severity: string;
  status: string; rootCause: string; suggestedFix: string; confidence: number;
};
type GoldenRow = { issue: string; resolution: string; source: string };

// Strip DeepSeek <think>...</think> blocks before returning to the user
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY ?? '',
      baseURL: NVIDIA_BASE_URL,
    });
  }
  return _client;
}

assistantRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    const pool = getPool();
    const platformId = req.user?.platformId;

    if (!platformId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Detect a specific incident code so we always find it regardless of recency
    const codeInMsg = message.match(/INC-[\w-]+/i)?.[0] ?? null;

    const [incidentRes, goldenRes, specificRes] = await Promise.all([
      pool.query<IncidentRow>(
        `SELECT code, title, service, LOWER(severity) AS severity, status, "rootCause", "suggestedFix", confidence
         FROM "Incident" WHERE "platformId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
        [platformId],
      ),
      pool.query<GoldenRow>(
        `SELECT issue, resolution, source FROM "GoldenRecord" ORDER BY "hitCount" DESC LIMIT 10`,
      ),
      codeInMsg
        ? pool.query<IncidentRow>(
            `SELECT code, title, service, LOWER(severity) AS severity, status, "rootCause", "suggestedFix", confidence
             FROM "Incident" WHERE "platformId" = $1 AND LOWER(code) = LOWER($2) LIMIT 1`,
            [platformId, codeInMsg],
          )
        : Promise.resolve(null),
    ]);

    // Merge specific incident at the top if not already in the preloaded 50
    if (specificRes?.rows[0]) {
      const specificCode = specificRes.rows[0].code.toLowerCase();
      const alreadyIn = incidentRes.rows.some(r => r.code.toLowerCase() === specificCode);
      if (!alreadyIn) incidentRes.rows.unshift(specificRes.rows[0]);
    }

    const incidents = incidentRes.rows;
    const golden = goldenRes.rows;

    const openCount = incidents.filter(i => i.status !== 'resolved' && i.status !== 'dismissed').length;
    const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'dismissed').length;
    const resolvedCount = incidents.filter(i => i.status === 'resolved').length;

    const incidentContext = incidents.length > 0
      ? incidents.map(i =>
          `[${i.code}] ${i.title} | service=${i.service} | severity=${i.severity.toUpperCase()} | status=${i.status} | confidence=${i.confidence}%\n  rootCause: ${i.rootCause ?? 'Pending'}\n  suggestedFix: ${i.suggestedFix ?? 'TBD'}`,
        ).join('\n\n')
      : 'No incidents recorded for this platform yet.';

    const goldenContext = golden.length > 0
      ? golden.map((g, i) => `[${i + 1}] Issue: ${g.issue}\n    Resolution: ${g.resolution}\n    Source: ${g.source}`).join('\n\n')
      : 'No golden records in the knowledge base yet.';

    const systemPrompt = `You are Sentinel AI, an expert Site Reliability Engineering (SRE) assistant embedded in the AI-Ops Sentinel incident management platform. You assist SRE and DevOps teams with incident response, root cause analysis, postmortems, service health, and general operational questions.

## Live Platform Data

**Incident Summary:** ${incidents.length} total | ${openCount} open | ${criticalCount} critical open | ${resolvedCount} resolved

**Recent Incidents (most recent 50):**
${incidentContext}

**Golden Records (top remediation knowledge base):**
${goldenContext}

## Your Capabilities
- Explain any incident by code (e.g. "explain INC-500-1024") with root cause and fix steps
- List open, critical, or filtered incidents
- Generate detailed postmortems with timeline, impact, action items
- Analyze error patterns and recurring issues across services
- Decode stack traces and error messages
- Suggest remediations from the golden records knowledge base
- Answer general SRE/DevOps questions (Kubernetes, Docker, CI/CD, observability, alerting, etc.)
- Explain concepts: SLI/SLO/SLA, error budgets, runbooks, on-call practices
- Help write runbooks, alerts, or monitoring queries
- Advise on architecture, reliability, and scalability topics

## Response Guidelines
- Be technical, precise, and actionable
- Use markdown formatting (headers, bold, code blocks, numbered lists)
- Reference specific incident codes when relevant
- For postmortems include: Summary, Timeline, Root Cause, Impact, Resolution, Action Items, Prevention
- Always state AI confidence level where applicable
- If asked something outside the incident data, use your SRE expertise to answer generally
- For code/config examples, use fenced code blocks with language tags`;

    const client = getClient();
    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 16384,
      stream: false,
    };
    // NVIDIA NIM specific param — not in OpenAI spec; disables thinking tokens
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (params as any).chat_template_kwargs = { thinking: false };
    const completion = await client.chat.completions.create(params);

    const raw = completion.choices[0]?.message?.content ?? '';
    const reply = stripThinking(raw) || 'I was unable to generate a response. Please try again.';

    res.json({ reply });
  } catch (err) {
    console.error('[AssistantController] Error:', err);
    res.status(500).json({ error: 'AI assistant failed to respond. Please try again.' });
  }
});
