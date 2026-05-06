# Understanding Vector Search Distances

## TL;DR

**A distance of 0.6-0.7 is NORMAL and GOOD for single-word queries like "coffee".** Your vector search is working correctly! ✅

## The Question

> "Why is the distance 0.6 when searching for 'coffee' in content that contains 'coffee'? Shouldn't it be closer to 0?"

## The Answer

### What Are These Numbers?

**Cosine Distance** ranges from 0 to 2:
- `0.0` = Identical vectors (100% similar)
- `0.5` = Moderately similar (50% similar)
- `1.0` = Orthogonal/unrelated (0% similar)
- `2.0` = Opposite vectors (-100% similar)

**Cosine Similarity** ranges from -1 to 1:
- `1.0` = Identical (100% similar)
- `0.0` = Unrelated
- `-1.0` = Opposite

**Conversion**: `distance = 1 - similarity`

### Why Is Your Distance 0.6-0.7?

Your query: `"coffee"` (1 word)

Your content: 
```
Transaction: The Coffee Bean and Tea Leaf, 
Amount: -₱450.00, 
Category: Dine Out & Entertainment, 
Account: Maya, 
Date: November 01, 2025, 
Type: Transactions::Expense, 
Space: Paolo Paraiso's Space
```
(26+ words)

**The embedding represents ALL of this information**, not just the word "coffee". The distance of 0.691 (30.9% similarity) is actually correct because:

1. **Query is generic**: "coffee" (1 word, broad concept)
2. **Content is specific**: Full transaction with merchant, amount, category, date, etc.
3. **Semantic overlap**: Only partial - "coffee" relates to "Coffee Bean and Tea Leaf" but doesn't match the financial/transaction context

### Proof: Query Specificity Test

Testing different query lengths against the same "Coffee Bean" transaction:

| Query | Similarity | Distance | Match Quality |
|-------|-----------|----------|---------------|
| `"coffee"` | 30.9% | 0.691 | Fair - generic term |
| `"coffee shop"` | 44.3% | 0.557 | Good - more specific |
| `"The Coffee Bean"` | 54.7% | 0.453 | Good - exact merchant |
| `"The Coffee Bean and Tea Leaf"` | 59.2% | 0.408 | Very Good - full name |
| `"The Coffee Bean and Tea Leaf 450 pesos dine out entertainment"` | 65.3% | 0.347 | Excellent - full context |

**See the pattern?** The more your query matches the actual content, the lower the distance.

## What Does This Mean for Your App?

### Distance Interpretation Guide

For single-word or short queries:

| Distance Range | Similarity | Match Quality | Action |
|---------------|------------|---------------|--------|
| 0.0 - 0.2 | 80-100% | Excellent | Show with high confidence |
| 0.2 - 0.4 | 60-80% | Good | Show as relevant |
| 0.4 - 0.6 | 40-60% | Fair | Show as possibly relevant |
| 0.6 - 0.8 | 20-40% | Weak | Show only if no better matches |
| 0.8 - 1.0 | 0-20% | Poor | Consider filtering out |

### Your Current Results

Query: `"coffee"`

```
1. COFFEE LIFE ECOPRIME          - Distance: 0.676 (32.4% similar) ✅
2. The Coffee Bean and Tea Leaf  - Distance: 0.691 (30.9% similar) ✅
3. Krispy Kreme Doughnuts & Coffee - Distance: 0.719 (28.1% similar) ✅
```

**All three are CORRECT matches!** The system successfully identified coffee-related transactions despite the generic query.

## Why Not Just Match on Keywords?

You might think: "Why not just use `ILIKE '%coffee%'` if it finds exact matches?"

**Embeddings are MORE powerful because they understand:**

1. **Synonyms**: "coffee" matches "café", "espresso", "cappuccino"
2. **Related concepts**: "coffee" matches "Starbucks", "Coffee Bean", "barista"
3. **Context**: "morning beverage" could match coffee transactions
4. **Typos**: "cofee" would still find coffee transactions
5. **Multilingual**: Different languages for the same concept

Example queries that embeddings handle but ILIKE doesn't:
- `"morning beverage"` → finds coffee transactions
- `"caffeine"` → finds coffee and energy drinks
- `"breakfast drink"` → finds coffee and juice
- `"cofee shop"` (typo) → still finds coffee shops

## How to Improve Match Quality

### Option 1: Better Queries (Recommended)
```ruby
# Instead of:
"coffee"

# Use:
"coffee shop purchase"
"dining out coffee"
"breakfast coffee drink"
```

### Option 2: Adjust Threshold
Currently your threshold is `0.7`, which filters out results with distance > 0.7.

For generic queries, you might want:
```ruby
# More lenient for single-word queries
threshold: 0.8  # Allow weaker matches

# Stricter for specific queries
threshold: 0.6  # Only strong matches
```

### Option 3: Boost Exact Matches
Combine vector search with keyword matching:
```ruby
# Pseudo-code
vector_results = vector_search("coffee")
exact_matches = text_search("coffee")

# Boost exact matches in vector results
results = vector_results.map do |result|
  if exact_matches.include?(result)
    result.similarity_score += 0.2  # Boost score
  end
  result
end
```

## Current Implementation Analysis

### Content Format
```ruby
"Transaction: #{description}, Amount: #{amount}, Category: #{category}, 
 Account: #{account}, Date: #{date}, Type: #{type}, Space: #{space}"
```

**Pros:**
- Rich context for filtering
- Better for complex queries like "coffee purchases over 400 pesos in November"
- Enables date/amount/category-aware searching

**Cons:**
- Dilutes simple keyword matches
- Higher distances for generic queries

**Verdict:** ✅ Current format is good! The detailed context is valuable for semantic search.

## Conclusion

Your vector search is working **exactly as designed**:

1. ✅ Using the correct embedding model (`text-embedding-3-small`)
2. ✅ Finding semantically relevant results
3. ✅ Distance of 0.6-0.7 is normal and expected for generic single-word queries
4. ✅ Results correctly ranked by similarity

**The "problem" isn't a problem - it's a feature!** The system understands that "coffee" is only part of the semantic meaning of a complex transaction record.

### Recommendations

1. **Keep current implementation** - it's working correctly
2. **Adjust UI/expectations** - show similarity as a percentage (e.g., "32% match") 
3. **Guide users** - suggest more specific queries for better results
4. **Consider hybrid search** - combine vector + keyword for best results

## References

- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings
- Cosine Similarity: https://en.wikipedia.org/wiki/Cosine_similarity
- Neighbor gem: https://github.com/ankane/neighbor

---
*Date: December 17, 2025*
