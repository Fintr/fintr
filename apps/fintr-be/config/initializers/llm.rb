# frozen_string_literal: true

module LlmConfig
  module_function

  def agent_provider
    explicit = ENV["LLM_AGENT_PROVIDER"].to_s.strip.downcase.presence
    return explicit if explicit.in?(%w[openrouter openai])

    if ENV["OPENROUTER_API_KEY"].present?
      "openrouter"
    else
      "openai"
    end
  end
end

Rails.application.configure do
  default_generation_model = ENV.fetch(
    "LLM_DEFAULT_MODEL",
    "google/gemini-2.5-flash-lite",
  ).presence || "google/gemini-2.5-flash-lite"

  config.x.llm.default_model = default_generation_model
  config.x.llm.fast_model = ENV.fetch("LLM_FAST_MODEL", "openai/gpt-4o-mini").presence || "openai/gpt-4o-mini"
  config.x.llm.agent_model = ENV.fetch("LLM_AGENT_MODEL", default_generation_model).presence || default_generation_model
  config.x.llm.agent_provider = LlmConfig.agent_provider
  config.x.llm.embedding_model = ENV.fetch("LLM_EMBEDDING_MODEL", "openai/text-embedding-3-small").presence || "openai/text-embedding-3-small"
end
