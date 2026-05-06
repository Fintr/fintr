# Vector Search Fix - Model Mismatch Issue

## Problem Summary

Vector search was returning completely irrelevant results when searching for "coffee". The text search (ILIKE) found 11 records with "coffee", but the vector search found 0 matches - instead returning random unrelated transactions like "Globe Telecom" and "Parking tip".

## Root Cause

**Embedding Model Mismatch**: The content embeddings and query embeddings were using different OpenAI models:

- **Content Embeddings** (transactions/transfers): `text-embedding-3-small`
- **Query Embeddings** (search queries): `text-embedding-ada-002`

### Why This Breaks Vector Search

Embeddings from different models exist in different vector spaces and are **not compatible** for similarity search. Even though both models produce 1536-dimensional vectors, they represent completely different semantic spaces. Comparing embeddings from different models is like trying to use a map of New York to navigate Tokyo - the dimensions match, but the coordinate systems are incompatible.

## Investigation Results

### Before Fix
```
Vector search for "coffee":
- 10 results returned
- 0 results actually contained "coffee"
- Results included: "Globe Telecom Inc", "Parking tip", "Transfer: Additional for laptop repair"
- Zero overlap with text search results
```

### After Fix
```
Vector search for "coffee":
- Top 3 results all contain "coffee"
- Similarity scores: 32.4%, 30.9%, 28.1%
- Results: "COFFEE LIFE ECOPRIME", "The Coffee Bean and Tea Leaf", "Krispy Kreme Doughnuts & Coffee"
- ✅ SUCCESS - Vector search now working correctly!
```

## Solution

Changed the default model in `GenerateQueryEmbedding` operation from `text-embedding-ada-002` to `text-embedding-3-small` to match the content embeddings.

### Files Modified

1. **app/operations/ai/operations/embeddings/generate_query_embedding.rb**
   - Changed default model from `text-embedding-ada-002` to `text-embedding-3-small`

2. **spec/operations/ai/operations/embeddings/generate_query_embedding_spec.rb**
   - Updated specs to expect the new default model

### Code Changes

```ruby
# Before
model = params[:model] || "text-embedding-ada-002"

# After
model = params[:model] || "text-embedding-3-small"
```

## Verification

All tests passing:
- ✅ RSpec: 18 examples, 0 failures
- ✅ Rubocop: No offenses detected
- ✅ Manual testing: Coffee search now returns relevant results

## Important Notes

1. **Both models must always match**: Any future changes to embedding models must ensure that content embeddings and query embeddings use the same model.

2. **No need to regenerate existing embeddings**: Since the content embeddings were already using `text-embedding-3-small`, they don't need to be regenerated.

3. **Model compatibility**: If you ever need to change models:
   - Change both `generate_embedding.rb` AND `generate_query_embedding.rb`
   - Regenerate ALL existing embeddings in the database
   - Test thoroughly before deploying

## Related Files

- `app/operations/ai/operations/embeddings/generate_embedding.rb` - Content embedding generation
- `app/operations/ai/operations/embeddings/generate_query_embedding.rb` - Query embedding generation
- `app/operations/ai/operations/rag/search_vectors.rb` - Vector search implementation
- `app/models/ai/rag_embedding.rb` - RAG embedding model

## Date

December 17, 2025
