# frozen_string_literal: true

RubyLLM.configure do |config|
  config.openai_api_key = ENV["OPENAI_API_KEY"]
  config.openrouter_api_key = ENV["OPENROUTER_API_KEY"]

  config.default_model = Rails.configuration.x.llm.default_model
  config.default_embedding_model = Rails.configuration.x.llm.embedding_model

  config.request_timeout = ENV.fetch("LLM_REQUEST_TIMEOUT", 120).to_i
  config.max_retries = ENV.fetch("LLM_MAX_RETRIES", 3).to_i
  config.tool_concurrency = ActiveModel::Type::Boolean.new.cast(
    ENV.fetch("LLM_TOOL_CONCURRENCY", "true"),
  )

  config.logger = Rails.logger
  config.log_level = Rails.env.production? ? :info : :debug
end
