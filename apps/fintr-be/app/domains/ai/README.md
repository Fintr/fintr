# AI Chat + RAG System - SOLID Architecture

## Overview

This is a comprehensive refactoring of the Fintr AI chat system following SOLID principles with OpenRouter integration.

## Architecture

### Directory Structure

```
app/domains/ai/
├── providers/              # LLM Provider Abstractions (DIP)
│   ├── base_provider.rb   # Abstract interface
│   ├── openrouter_provider.rb
│   ├── openai_fallback_provider.rb
│   └── provider_factory.rb
├── conversations/          # Conversation Management (SRP)
│   ├── context_builder.rb
│   └── message_repository.rb
├── rag/                    # RAG Pipeline (SRP)
│   ├── rag_pipeline.rb
│   ├── query_analyzer.rb
│   └── vector_searcher.rb
├── charts/                 # Chart Management (SRP)
│   ├── aggregators/
│   └── chart_service.rb
├── prompts/                # Prompt Management (SRP)
│   ├── prompt_service.rb
│   └── templates/
└── jobs/
    └── ai_chat_job.rb      # Orchestration (SRP)
```

## SOLID Compliance

### Single Responsibility Principle
Each class has exactly one reason to change:
- `OpenrouterProvider` - Only handles OpenRouter API communication
- `ContextBuilder` - Only builds conversation context from database
- `QueryAnalyzer` - Only analyzes user queries
- `RagPipeline` - Only orchestrates the RAG flow

### Open/Closed Principle
Open for extension, closed for modification:
```ruby
# Add new providers without modifying existing code
ProviderFactory.register(:new_provider, NewProviderClass)

# Add new chart aggregators
ChartService.register_aggregator(:new_type, NewAggregator)
```

### Liskov Substitution Principle
All providers can be substituted:
```ruby
providers = [
  OpenrouterProvider.new,
  OpenaiFallbackProvider.new
]

providers.each do |provider|
  provider.chat(messages: [], model: 'test') # Works for all
end
```

### Interface Segregation Principle
Small, focused interfaces:
```ruby
class BaseProvider
  def chat(messages:, model:, **options); end
  def embeddings(text:, model: nil); end
  def healthy?; end
end
```

### Dependency Inversion Principle
Depend on abstractions:
```ruby
class AiChatJob
  def initialize(
    rag_pipeline: RagPipeline.new,      # Abstract
    response_generator: ResponseGenerator.new,
    broadcaster: ChatBroadcaster.new
  )
```

## Usage

### Basic Usage

```ruby
# Create a provider
provider = Ai::Providers::ProviderFactory.create(:openrouter)

# Execute RAG pipeline
pipeline = Ai::Rag::RagPipeline.new
result = pipeline.execute(
  query: "What's my biggest expense?",
  space_id: "space-uuid",
  conversation_id: "conv-uuid"
)

# Generate response
response = Ai::ResponseGenerator.new.generate(
  prompt: result[:prompt],
  conversation_id: "conv-uuid"
)
```

### With Fallback

```ruby
# Create provider with automatic fallback
provider = Ai::Providers::ProviderFactory.create_with_fallback(
  primary: :openrouter,
  fallback: :openai
)

# If OpenRouter fails, automatically switches to OpenAI
provider.chat(messages: [], model: 'gpt-4o')
```

### Smart Model Selection

```ruby
selector = Ai::CuratedModelSelector.new

# Automatically selects best model based on query
model = selector.select(:response_generation, query: user_query)

# Get multiple options with reasoning
options = selector.select_with_reasoning(:response_generation, query: user_query)
# => {
#   primary: { model: ..., reasoning: "Best balance of quality and cost" },
#   fast: { model: ..., reasoning: "Faster response" },
#   cost_effective: { model: ..., reasoning: "Cheaper option" }
# }
```

### Conversation Context

```ruby
# Build messages with context
builder = Ai::Conversations::ContextBuilder.new(conversation_id: "conv-uuid")
messages = builder.build(
  system_prompt: "You are a financial assistant...",
  user_query: "What about last month?"
)

# Messages include:
# 1. System prompt
# 2. Last 10 conversation messages
# 3. Current user query
```

### Chart Data Limiting

```ruby
# Automatically limits chart data to 6 items
service = Ai::Charts::ChartService.new(max_items: 6)
data = {
  "Food" => { value: 1000 },
  "Rent" => { value: 2000 },
  "Transport" => { value: 500 },
  # ... 20 more categories
}

limited = service.prepare(data)
# => { "Rent" => {...}, "Food" => {...}, ..., "Others" => { value: 3000 } }
```

## Model Registry

The system includes a curated model registry with the best models for financial assistants:

### Fast Models
- `openai/gpt-4o-mini` - Best for simple queries
- `anthropic/claude-3-haiku` - Great for safety-critical tasks
- `google/gemini-flash-1.5` - Massive context window (1M tokens)

### Balanced Models
- `openai/gpt-4o` - Best overall for financial analysis
- `anthropic/claude-3-sonnet` - Excellent reasoning
- `meta-llama/llama-3.1-70b` - Open source, cost-effective

### Powerful Models
- `anthropic/claude-3-opus` - Most capable for complex tasks
- `google/gemini-pro-1.5` - Huge context (2M tokens)
- `openai/gpt-4o-latest` - Latest GPT-4o with best reasoning

## Observability

The system includes comprehensive observability:

```ruby
# Metrics are automatically collected
Ai::Observability.metrics(requests: 100, errors: 2, latency_ms: 250)

# Health checks
Ai::Observability.health_check(:openrouter) # => :healthy

# Usage tracking
Ai::Observability.track_usage(
  provider: :openrouter,
  model: 'gpt-4o-mini',
  input_tokens: 500,
  output_tokens: 200
)
```

## Testing

Run the test suite:

```bash
# Provider tests
bundle exec rspec spec/domains/ai/providers/

# RAG pipeline tests
bundle exec rspec spec/domains/ai/rag/

# Integration tests
bundle exec rspec spec/integration/

# All AI domain tests
bundle exec rspec spec/domains/ai/
```

## Configuration

Environment variables:

```bash
# Required
OPENROUTER_API_KEY=your_openrouter_key

# Optional but recommended
OPENAI_API_KEY=your_openai_key  # For fallback and embeddings
APP_URL=https://your-app.com

# Agentic RAG (RubyLLM tool loop)
AI_AGENTIC_RAG_ENABLED=false          # Kill switch; set true to enable agentic pipeline
LLM_DEFAULT_MODEL=google/gemini-2.5-flash-lite
LLM_AGENT_MODEL=google/gemini-2.5-flash-lite  # Model for tool-calling agent loop
LLM_AGENT_PROVIDER=openrouter         # openrouter or openai (auto-detects from keys)
LLM_EMBEDDING_MODEL=text-embedding-3-small
LLM_FAST_MODEL=openai/gpt-4o-mini
LLM_REQUEST_TIMEOUT=120
LLM_MAX_RETRIES=3
LLM_TOOL_CONCURRENCY=true

# Optional
OPENROUTER_PROVIDER_ORDER=OpenAI,Anthropic,Google
ENABLE_STRUCTURED_RESPONSES=true
MAX_CHART_ITEMS=6
```

### Agentic vs single-shot RAG

When `AI_AGENTIC_RAG_ENABLED=true`, `AiChatJob` runs a RubyLLM agent that calls tools iteratively:

- `search_transactions` — semantic vector search (reuses `VectorSearcher`)
- `query_financial_data` — structured aggregates (reuses `DataRetriever`)
- `fetch_transaction` — detail lookup by `[txn:N]` id
- `list_accounts` — orient the agent to available accounts
- `note` — reasoning trail stored in message metadata

When disabled (default), the existing single-shot pipeline runs unchanged.

## Migration from Old Code

The old operations continue to work through an adapter layer:

```ruby
# Old way (still works)
Ai::Operations::Rag::Analysis::AnalyzeQueryIntent.new.call(
  query: "test",
  space_id: "space-uuid"
)

# New way (recommended)
Ai::Rag::QueryAnalyzer.new.analyze(
  query: "test",
  space_id: "space-uuid"
)
```

## Benefits

1. **Reliability**: Automatic fallback between providers
2. **Cost Optimization**: Smart model selection based on query complexity
3. **Testability**: Each component can be tested in isolation
4. **Extensibility**: Easy to add new providers, models, or features
5. **Maintainability**: Small, focused classes are easier to understand
6. **Observability**: Comprehensive metrics and health checks

## Backward Compatibility

All existing code continues to work through adapter layers:
- `AnalyzeQueryIntent` uses new `QueryAnalyzer`
- `ProcessStreamingRagQuery` uses new `RagPipeline`
- Existing database schema unchanged
- Existing API contracts maintained
