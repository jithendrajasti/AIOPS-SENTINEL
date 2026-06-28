import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getPool } from '../config/database';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export const assistantRouter = Router();

const MOCK_AI = process.env.MOCK_AI === 'true';
const CHAT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

type IncidentRow = {
  code: string; title: string; service: string; severity: string;
  status: string; rootCause: string; suggestedFix: string; confidence: number;
};
type GoldenRow = { issue: string; resolution: string; source: string };

function buildMockReply(message: string, incidents: IncidentRow[], golden: GoldenRow[]): string {
  const msg = message.toLowerCase();
  const openIncidents = incidents.filter(i => i.status !== 'resolved' && i.status !== 'dismissed');
  const criticalIncidents = incidents.filter(i => i.severity === 'critical');

  // Postmortem request
  if (msg.includes('postmortem') || msg.includes('post-mortem') || msg.includes('post mortem')) {
    const target = criticalIncidents[0] ?? incidents[0];
    if (!target) return 'No incidents found to generate a postmortem for.';
    return `## Postmortem: ${target.code} — ${target.title}\n\n**Status:** ${target.status} | **Severity:** ${target.severity.toUpperCase()} | **Service:** ${target.service}\n\n### Summary\n${target.rootCause}\n\n### Impact\nThis incident affected ${target.service} and its downstream dependencies. AI confidence: **${target.confidence}%**.\n\n### Root Cause\n${target.rootCause}\n\n### Resolution Steps\n${target.suggestedFix ?? 'Manual investigation required.'}\n\n### Action Items\n- [ ] Apply suggested fix\n- [ ] Add monitoring alerts for early detection\n- [ ] Document in golden records knowledge base\n- [ ] Schedule post-incident review with team\n\n### Prevention\nConsider adding the resolution to Golden Records to prevent recurrence.`;
  }

  // Stack trace / error explanation
  if (msg.includes('stack trace') || msg.includes('stacktrace') || msg.includes('exception') || msg.includes('error')) {
    const relevant = incidents.find(i => msg.includes(i.service) || msg.includes(i.code.toLowerCase())) ?? incidents[0];
    if (!relevant) return 'No incidents found matching your query. Please check the incident code or service name.';
    return `## Stack Trace Analysis for ${relevant.code}\n\n**Service:** ${relevant.service} | **Severity:** ${relevant.severity.toUpperCase()}\n\n### Root Cause (${relevant.confidence}% confidence)\n${relevant.rootCause}\n\n### Diagnosis Steps\n1. Check the service logs for the time window around the incident\n2. Look for connection/timeout patterns matching the root cause\n3. Verify resource utilization (CPU, memory, connections) at incident time\n\n### Suggested Fix\n${relevant.suggestedFix ?? 'Review raw logs and investigate manually.'}`;
  }

  // Similar incidents request
  if (msg.includes('similar') || msg.includes('pattern') || msg.includes('recurrence')) {
    const grouped: Record<string, IncidentRow[]> = {};
    for (const inc of incidents) {
      const key = inc.service;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(inc);
    }
    const multipleHits = Object.entries(grouped).filter(([, v]) => v.length > 1);
    if (multipleHits.length === 0) {
      return `No repeated incident patterns detected. All ${incidents.length} incidents appear to be unique events across different services.`;
    }
    const lines = multipleHits.map(([svc, incs]) =>
      `**${svc}** — ${incs.length} incidents: ${incs.map(i => i.code).join(', ')}`,
    ).join('\n');
    const gr = golden[0];
    return `## Repeated Incident Patterns\n\nI found the following services with multiple incidents:\n\n${lines}\n\n### Recommended Action\nServices with recurring incidents should have their root causes added to the **Golden Records** knowledge base to accelerate future resolution.\n\n${gr ? `**Most applicable golden record:** "${gr.issue.slice(0, 80)}" → ${gr.resolution.slice(0, 100)}…` : ''}`;
  }

  // Open incidents summary
  if (msg.includes('open') || msg.includes('active') || msg.includes('current') || msg.includes('status')) {
    if (openIncidents.length === 0) {
      return '✅ **All incidents are resolved.** No open or investigating incidents at this time.';
    }
    const list = openIncidents.map(i =>
      `- **${i.code}** (${i.severity.toUpperCase()}) — ${i.title}\n  Service: ${i.service} | Status: ${i.status}\n  Root Cause: ${i.rootCause}`,
    ).join('\n\n');
    return `## Open Incidents (${openIncidents.length})\n\n${list}\n\n### Recommendation\nFocus on **CRITICAL** severity incidents first. Use the Sentinel AI assistant or golden records to find applicable remediations.`;
  }

  // Critical incidents
  if (msg.includes('critical') || msg.includes('urgent') || msg.includes('severe')) {
    if (criticalIncidents.length === 0) {
      return '✅ No CRITICAL incidents found in the system.';
    }
    const list = criticalIncidents.map(i =>
      `- **${i.code}** — ${i.title}\n  Service: ${i.service} | Status: ${i.status}\n  Fix: ${(i.suggestedFix ?? 'TBD').split('\n')[0]}`,
    ).join('\n\n');
    return `## Critical Incidents (${criticalIncidents.length})\n\n${list}`;
  }

  // Look for specific incident code
  const codeMatch = message.match(/INC-[\w-]+/i);
  if (codeMatch) {
    const found = incidents.find(i => i.code.toLowerCase() === codeMatch[0].toLowerCase());
    if (found) {
      return `## ${found.code} — ${found.title}\n\n**Service:** ${found.service} | **Severity:** ${found.severity.toUpperCase()} | **Status:** ${found.status}\n\n### Root Cause (${found.confidence}% confidence)\n${found.rootCause}\n\n### Suggested Fix\n${found.suggestedFix ?? 'Review raw logs and investigate manually.'}`;
    }
    return `Incident ${codeMatch[0]} not found in the database. Please verify the incident code.`;
  }

  // General summary / catch-all
  const resolved = incidents.filter(i => i.status === 'resolved').length;
  const grCount = golden.length;
  return `## System Summary\n\n📊 **${incidents.length} total incidents** — ${openIncidents.length} open, ${resolved} resolved\n🔴 **${criticalIncidents.length} critical** incidents\n📚 **${grCount} golden records** in knowledge base\n\n### Top Open Issues\n${openIncidents.slice(0, 3).map(i => `- **${i.code}** (${i.severity.toUpperCase()}) ${i.title} — ${i.service}`).join('\n') || 'None'}\n\n### What I can help with\n- Explain a specific incident (e.g., "explain INC-500-1024")\n- Generate a postmortem report\n- Find similar incident patterns\n- Decode stack traces and errors\n- Suggest remediations from golden records\n\nAsk me anything about your incidents!`;
}

let _chatModel: ChatGoogleGenerativeAI | null = null;
function getChatModel(): ChatGoogleGenerativeAI {
  if (!_chatModel) {
    _chatModel = new ChatGoogleGenerativeAI({
      model: CHAT_MODEL,
      temperature: 0.3,
      maxOutputTokens: 1000,
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return _chatModel;
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

    // Detect a specific incident code in the message so we can fetch it by name
    const codeInMsg = message.match(/INC-[\w-]+/i)?.[0] ?? null;

    const [incidentRes, goldenRes, specificRes] = await Promise.all([
      pool.query<{
        code: string; title: string; service: string; severity: string;
        status: string; rootCause: string; suggestedFix: string; confidence: number;
      }>(
        `SELECT code, title, service, LOWER(severity) AS severity, status, "rootCause", "suggestedFix", confidence
         FROM "Incident" WHERE "platformId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
        [platformId],
      ),
      pool.query<{ issue: string; resolution: string; source: string }>(
        `SELECT issue, resolution, source FROM "GoldenRecord" ORDER BY "hitCount" DESC LIMIT 5`,
      ),
      codeInMsg
        ? pool.query<{
            code: string; title: string; service: string; severity: string;
            status: string; rootCause: string; suggestedFix: string; confidence: number;
          }>(
            `SELECT code, title, service, LOWER(severity) AS severity, status, "rootCause", "suggestedFix", confidence
             FROM "Incident" WHERE "platformId" = $1 AND LOWER(code) = LOWER($2) LIMIT 1`,
            [platformId, codeInMsg],
          )
        : Promise.resolve(null),
    ]);

    // Merge the specifically-requested incident into the top of the list (if not already present)
    if (specificRes?.rows[0]) {
      const specificCode = specificRes.rows[0].code.toLowerCase();
      const alreadyIn = incidentRes.rows.some(r => r.code.toLowerCase() === specificCode);
      if (!alreadyIn) {
        incidentRes.rows.unshift(specificRes.rows[0]);
      }
    }

    const incidentContext = incidentRes.rows.length > 0
      ? incidentRes.rows.map(i =>
          `- [${i.code}] ${i.title} | Service: ${i.service} | Severity: ${i.severity} | Status: ${i.status} | Root Cause: ${i.rootCause ?? 'Pending'} | Fix: ${i.suggestedFix ?? 'TBD'} | Confidence: ${i.confidence}%`,
        ).join('\n')
      : 'No incidents in the system yet.';

    const goldenContext = goldenRes.rows.length > 0
      ? goldenRes.rows.map(g => `- Issue: ${g.issue} | Resolution: ${g.resolution} | Source: ${g.source}`).join('\n')
      : 'No golden records available yet.';

    if (MOCK_AI) {
      const reply = buildMockReply(message, incidentRes.rows, goldenRes.rows);
      res.json({ reply });
      return;
    }

    const systemPrompt = `You are Sentinel AI, an expert Site Reliability Engineering (SRE) assistant integrated into the AI-Ops Sentinel platform. You help SRE teams rapidly understand, diagnose, and resolve production incidents.

You have access to the following live system data:

**Recent Incidents (latest 10):**
${incidentContext}

**Golden Records (top remediation knowledge base):**
${goldenContext}

Guidelines:
- Be technical, concise, and actionable
- Reference specific incident codes (e.g., INC-500-1024) when relevant
- Suggest fixes based on the golden records when applicable
- Use markdown for formatting (bold, code blocks, lists)
- For postmortems, include: summary, timeline, root cause, impact, action items
- If asked about a specific incident code, reference the data above
- Always clarify confidence levels and when manual investigation is needed`;

    const model = getChatModel();
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(message),
    ]);

    const reply = response.content?.toString() ?? 'I was unable to generate a response. Please try again.';

    res.json({ reply });
  } catch (err) {
    console.error('[AssistantController] Error:', err);
    res.status(500).json({ error: 'AI assistant failed to respond. Please try again.' });
  }
});
