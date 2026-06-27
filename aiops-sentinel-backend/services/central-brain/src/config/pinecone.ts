import { Pinecone, type Index } from '@pinecone-database/pinecone';

let _index: Index | null = null;

export function getPineconeIndex(): Index {
  if (!_index) {
    const indexName = process.env.PINECONE_INDEX_NAME ?? 'aiops-incidents';

    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY ?? '',
    });

    // .index() is synchronous in SDK v3 — no await needed
    _index = pc.index(indexName);
    console.log(`[Pinecone] Client ready → index: "${indexName}"`);
  }
  return _index;
}
