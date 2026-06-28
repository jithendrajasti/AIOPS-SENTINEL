import { v4 as uuidv4 } from 'uuid';
import { getPineconeIndex } from '../config/pinecone';
import { getPool } from '../config/database';
import type { Anomaly, RcaResult, ResolutionPayload, GoldenRecordMetadata } from '../types/index';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PineconeStore, PineconeEmbeddings } from '@langchain/pinecone';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

// ── Config ─────────────────────────────────────────────────────────────────────

const MOCK_AI = process.env.MOCK_AI === 'true';
const EMBED_MODEL = 'llama-text-embed-v2';
const CHAT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-pro';
const SIMILARITY_THRESHOLD = 0.7;
const DEDUP_THRESHOLD = 0.95;       // above this → update hitCount instead of inserting
const TTL_MS = 180 * 24 * 3600 * 1_000;  // 6 months in milliseconds
const PINECONE_TOP_K = 3;

// ── SendStrategy pattern ───────────────────────────────────────────────────────

type RcaStrategy = (anomaly: Anomaly) => Promise<RcaResult>;
type IngestStrategy = (payload: ResolutionPayload) => Promise<IngestResult>;

interface IngestResult {
  action: 'inserted' | 'updated';
  recordId: string;
}

// ── LangChain Initializers ─────────────────────────────────────────────────────

let _embeddings: PineconeEmbeddings | null = null;
function getEmbeddings(): PineconeEmbeddings {
  if (!_embeddings) {
    _embeddings = new PineconeEmbeddings({
      model: EMBED_MODEL,
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return _embeddings;
}

let _chatModel: ChatGoogleGenerativeAI | null = null;
function getChatModel(): ChatGoogleGenerativeAI {
  if (!_chatModel) {
    _chatModel = new ChatGoogleGenerativeAI({
      model: CHAT_MODEL,
      temperature: 0.2,
      maxOutputTokens: 512,
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return _chatModel;
}

// ── Mock Strategies ────────────────────────────────────────────────────────────

function createMockRcaStrategy(): RcaStrategy {
  return async (anomaly: Anomaly): Promise<RcaResult> => {
    console.log(`[RagPipeline] MOCK — RCA for anomaly ${anomaly.id} (set MOCK_AI=false for real AI)`);
    return {
      anomalyId: anomaly.id,
      source: anomaly.source,
      severity: anomaly.severity,
      rootCause: `[MOCK] Pattern "${anomaly.matchedPattern}" detected in "${anomaly.source}". Set MOCK_AI=false and provide GEMINI_API_KEY for real analysis.`,
      suggestedFix: '[MOCK] Provide GEMINI_API_KEY and PINECONE_API_KEY to enable AI-generated root cause analysis.',
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
    
    // Mirror new record in PostgreSQL for the golden-records list page
    getPool().query(
      `INSERT INTO "GoldenRecord" (id, "pineconeId", title, issue, resolution, source, tags, "hitCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW())
       ON CONFLICT ("pineconeId") DO UPDATE SET "hitCount" = "GoldenRecord"."hitCount" + 1, "updatedAt" = NOW()`,
      [
        uuidv4(),
        recordId,
        payload.issue.slice(0, 60),
        payload.issue,
        payload.resolution,
        payload.source,
        JSON.stringify(tagList),
      ],
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

    // Langchain RAG query
    const results = await vectorStore.similaritySearchWithScore(anomaly.logSnippet, PINECONE_TOP_K);
    const strongMatches = results.filter(([_, score]) => score >= SIMILARITY_THRESHOLD);
    
    const historicalContext = strongMatches.map(([doc]) => {
      const meta = doc.metadata as unknown as GoldenRecordMetadata;
      return `Issue: ${meta.issue}\nResolution: ${meta.resolution}`;
    });

    const prompt = buildRcaPrompt(anomaly, historicalContext);
    let parsed: LlmResponse = {};
    
    try {
      const model = getChatModel();
      const response = await model.invoke([new HumanMessage(prompt)]);

      // Attempt to clean any potential markdown formatting (e.g. ```json ... ```)
      let content = response.content?.toString() ?? '';
      content = content.replace(/^```json/i, '').replace(/```$/, '').trim();
      
      if (content) parsed = JSON.parse(content) as LlmResponse;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[RagPipeline] LLM call failed: ${message}`);
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

// ── Real Ingest Strategy (Post-Resolution Pipeline) ───────────────────────────

function createRealIngestStrategy(): IngestStrategy {
  return async (payload: ResolutionPayload): Promise<IngestResult> => {
    const index = getPineconeIndex();
    const combinedText = `Issue: ${payload.issue} Resolution: ${payload.resolution}`;
    
    // We can still use the raw embeddings for precise ID-based upsert and dedup
    const embeddingArray = await getEmbeddings().embedQuery(combinedText);

    // Deduplication: query for near-identical records before inserting
    const existing = await index.query({
      vector: embeddingArray,
      topK: 1,
      includeMetadata: true,
    });

    const topMatch = existing.matches[0];

    if (topMatch && (topMatch.score ?? 0) >= DEDUP_THRESHOLD) {
      const meta = topMatch.metadata as unknown as GoldenRecordMetadata;
      await index.update({
        id: topMatch.id,
        metadata: { hitCount: meta.hitCount + 1 },
      });
      // Mirror hitCount update in PostgreSQL
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

    // Upsert directly to pinecone index for explicit ID and metadata control
    await index.upsert([{
      id: recordId,
      values: embeddingArray,
      metadata: metadata as unknown as Record<string, string | number | boolean | string[]>,
      // To play nicely with Langchain PineconeStore, we also inject text field:
    }]);
    
    // Wait, Langchain expects 'text' in metadata to retrieve it during search!
    // We should ensure 'text' is set so similaritySearchWithScore returns the content.
    await index.update({
      id: recordId,
      metadata: { text: combinedText }
    }).catch(() => {});

    // Mirror new record in PostgreSQL for the golden-records list page
    getPool().query(
      `INSERT INTO "GoldenRecord" (id, "pineconeId", title, issue, resolution, source, tags, "hitCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW(), NOW())
       ON CONFLICT ("pineconeId") DO UPDATE SET "hitCount" = "GoldenRecord"."hitCount" + 1, "updatedAt" = NOW()`,
      [
        uuidv4(),
        recordId,
        payload.issue.slice(0, 60),
        payload.issue,
        payload.resolution,
        payload.source,
        JSON.stringify(tagList),
      ],
    ).catch(() => {});

    console.log(`[RagPipeline] Ingested new Golden Record: ${recordId}`);
    return { action: 'inserted', recordId };
  };
}

// ── Strategy Resolution (module-load time, once) ──────────────────────────────

const _rcaStrategy: RcaStrategy = MOCK_AI
  ? createMockRcaStrategy()
  : createRealRcaStrategy();

const _ingestStrategy: IngestStrategy = MOCK_AI
  ? createMockIngestStrategy()
  : createRealIngestStrategy();

// ── Public API ─────────────────────────────────────────────────────────────────

export async function runRcaPipeline(anomaly: Anomaly): Promise<RcaResult> {
  return _rcaStrategy(anomaly);
}

export async function ingestResolution(payload: ResolutionPayload): Promise<IngestResult> {
  return _ingestStrategy(payload);
}
