import { v4 as uuidv4 } from 'uuid';
import { getPineconeIndex } from '../config/pinecone';
import { getPool } from '../config/database';
import type { Anomaly, RcaResult, ResolutionPayload, GoldenRecordMetadata } from '../types/index';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';

// ── Config ─────────────────────────────────────────────────────────────────────

const MOCK_AI = process.env.MOCK_AI === 'true';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const EMBED_MODEL = process.env.NVIDIA_EMBED_MODEL ?? 'nvidia/nv-embedqa-e5-v5';
const CHAT_MODEL = process.env.NVIDIA_MODEL ?? 'deepseek-ai/deepseek-v4-flash';
const SIMILARITY_THRESHOLD = 0.7;
const DEDUP_THRESHOLD = 0.95;
const TTL_MS = 180 * 24 * 3600 * 1_000;
const PINECONE_TOP_K = 3;

// ── Strategy types ─────────────────────────────────────────────────────────────

type RcaStrategy = (anomaly: Anomaly) => Promise<RcaResult>;
type IngestStrategy = (payload: ResolutionPayload) => Promise<IngestResult>;

interface IngestResult {
  action: 'inserted' | 'updated';
  recordId: string;
}

// ── NVIDIA NIM client initializers ─────────────────────────────────────────────

let _embeddings: OpenAIEmbeddings | null = null;
function getEmbeddings(): OpenAIEmbeddings {
  if (!_embeddings) {
    _embeddings = new OpenAIEmbeddings({
      model: EMBED_MODEL,
      apiKey: process.env.NVIDIA_API_KEY,
      configuration: { baseURL: NVIDIA_BASE_URL },
    });
  }
  return _embeddings;
}

let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY ?? '',
      baseURL: NVIDIA_BASE_URL,
    });
  }
  return _openaiClient;
}

// Strip DeepSeek thinking tokens from model output
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// ── Mock Strategies ────────────────────────────────────────────────────────────

function createMockRcaStrategy(): RcaStrategy {
  return async (anomaly: Anomaly): Promise<RcaResult> => {
    console.log(`[RagPipeline] MOCK — RCA for anomaly ${anomaly.id} (set MOCK_AI=false for real AI)`);
    return {
      anomalyId: anomaly.id,
      source: anomaly.source,
      severity: anomaly.severity,
      rootCause: `[MOCK] Pattern "${anomaly.matchedPattern}" detected in "${anomaly.source}". Set MOCK_AI=false and provide NVIDIA_API_KEY for real analysis.`,
      suggestedFix: '[MOCK] Provide NVIDIA_API_KEY to enable AI-generated root cause analysis.',
      confidence: 0,
      generatedAt: new Date().toISOString(),
      historicalMatches: 0,
    };
  };
}

function createMockIngestStrategy(): IngestStrategy {
  return async (payload: ResolutionPayload): Promise<IngestResult> => {
    const recordId = `mock-golden-${payload.anomalyId || Date.now()}-${Date.now()}`;
    const tagList = Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [payload.source];

    getPool().query(
      `INSERT INTO "GoldenRecord" (id, "pineconeId", title, issue, resolution, source, tags, "hitCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW())
       ON CONFLICT ("pineconeId") DO UPDATE SET "hitCount" = "GoldenRecord"."hitCount" + 1, "updatedAt" = NOW()`,
      [uuidv4(), recordId, payload.issue.slice(0, 60), payload.issue, payload.resolution, payload.source, JSON.stringify(tagList)],
    ).catch(() => {});

    console.log(`[RagPipeline] MOCK — ingested Golden Record to DB (skipped Pinecone): ${recordId}`);
    return { action: 'inserted', recordId };
  };
}

// ── Real RCA Strategy ──────────────────────────────────────────────────────────

function buildRcaPrompt(anomaly: Anomaly, historicalContext: string[]): string {
  const contextBlock = historicalContext.length > 0
    ? historicalContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')
    : 'No similar historical incidents found in knowledge base.';

  return `You are an expert Site Reliability Engineer performing a Root Cause Analysis.

ANOMALY:
- Source: ${anomaly.source}
- Severity: ${anomaly.severity}
- Pattern Matched: ${anomaly.matchedPattern}
- Window Error Rate: ${Math.round(anomaly.windowErrorRate * 100)}%
- Timestamp: ${anomaly.timestamp}
- Log: ${anomaly.logSnippet}

HISTORICAL CONTEXT (similar past incidents, ordered by relevance):
${contextBlock}

Respond ONLY with a JSON object — no prose outside the braces. Format exactly like this:
{
  "rootCause": "2-3 sentence technical explanation of the most likely root cause",
  "suggestedFix": "Numbered, actionable steps to resolve this issue",
  "confidence": 0.95
}`;
}

interface LlmResponse {
  rootCause?: string;
  suggestedFix?: string;
  confidence?: number;
}

function createRealRcaStrategy(): RcaStrategy {
  return async (anomaly: Anomaly): Promise<RcaResult> => {
    const index = getPineconeIndex();
    const vectorStore = new PineconeStore(getEmbeddings(), { pineconeIndex: index });

    const results = await vectorStore.similaritySearchWithScore(anomaly.logSnippet, PINECONE_TOP_K);
    const strongMatches = results.filter(([_, score]) => score >= SIMILARITY_THRESHOLD);

    const historicalContext = strongMatches.map(([doc]) => {
      const meta = doc.metadata as unknown as GoldenRecordMetadata;
      return `Issue: ${meta.issue}\nResolution: ${meta.resolution}`;
    });

    const prompt = buildRcaPrompt(anomaly, historicalContext);
    let parsed: LlmResponse = {};

    try {
      const client = getOpenAIClient();
      const rcaParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model: CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 4096,
        stream: false,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rcaParams as any).chat_template_kwargs = { thinking: false };
      const completion = await client.chat.completions.create(rcaParams);
      let content = completion.choices[0]?.message?.content ?? '';
      content = stripThinking(content);
      content = content.replace(/^```json/i, '').replace(/```$/, '').trim();
      if (content) parsed = JSON.parse(content) as LlmResponse;
    } catch (err) {
      console.error(`[RagPipeline] LLM call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      anomalyId: anomaly.id,
      source: anomaly.source,
      severity: anomaly.severity,
      rootCause: parsed.rootCause ?? 'RCA generation failed — manual investigation required.',
      suggestedFix: parsed.suggestedFix ?? 'Review raw logs and investigate manually.',
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      generatedAt: new Date().toISOString(),
      historicalMatches: strongMatches.length,
    };
  };
}

// ── Real Ingest Strategy ───────────────────────────────────────────────────────

function createRealIngestStrategy(): IngestStrategy {
  return async (payload: ResolutionPayload): Promise<IngestResult> => {
    const index = getPineconeIndex();
    const combinedText = `Issue: ${payload.issue} Resolution: ${payload.resolution}`;

    const embeddingArray = await getEmbeddings().embedQuery(combinedText);

    const existing = await index.query({ vector: embeddingArray, topK: 1, includeMetadata: true });
    const topMatch = existing.matches[0];

    if (topMatch && (topMatch.score ?? 0) >= DEDUP_THRESHOLD) {
      const meta = topMatch.metadata as unknown as GoldenRecordMetadata;
      await index.update({ id: topMatch.id, metadata: { hitCount: meta.hitCount + 1 } });
      getPool().query(
        `UPDATE "GoldenRecord" SET "hitCount" = "hitCount" + 1, "updatedAt" = NOW() WHERE "pineconeId" = $1`,
        [topMatch.id],
      ).catch(() => {});
      console.log(`[RagPipeline] Dedup — incremented hitCount for record ${topMatch.id}`);
      return { action: 'updated', recordId: topMatch.id };
    }

    const recordId = `golden-${payload.anomalyId || Date.now()}-${Date.now()}`;
    const tagList = Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [payload.source];
    const metadata: GoldenRecordMetadata = {
      issue: payload.issue,
      resolution: payload.resolution,
      source: payload.source,
      hitCount: 1,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + TTL_MS,
      tags: tagList,
    };

    await index.upsert([{
      id: recordId,
      values: embeddingArray,
      metadata: metadata as unknown as Record<string, string | number | boolean | string[]>,
    }]);

    await index.update({ id: recordId, metadata: { text: combinedText } }).catch(() => {});

    getPool().query(
      `INSERT INTO "GoldenRecord" (id, "pineconeId", title, issue, resolution, source, tags, "hitCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW())
       ON CONFLICT ("pineconeId") DO UPDATE SET "hitCount" = "GoldenRecord"."hitCount" + 1, "updatedAt" = NOW()`,
      [uuidv4(), recordId, payload.issue.slice(0, 60), payload.issue, payload.resolution, payload.source, JSON.stringify(tagList)],
    ).catch(() => {});

    console.log(`[RagPipeline] Ingested new Golden Record: ${recordId}`);
    return { action: 'inserted', recordId };
  };
}

// ── Strategy resolution ────────────────────────────────────────────────────────

const _rcaStrategy: RcaStrategy = MOCK_AI ? createMockRcaStrategy() : createRealRcaStrategy();
const _ingestStrategy: IngestStrategy = MOCK_AI ? createMockIngestStrategy() : createRealIngestStrategy();

// ── Public API ─────────────────────────────────────────────────────────────────

export async function runRcaPipeline(anomaly: Anomaly): Promise<RcaResult> {
  return _rcaStrategy(anomaly);
}

export async function ingestResolution(payload: ResolutionPayload): Promise<IngestResult> {
  return _ingestStrategy(payload);
}
