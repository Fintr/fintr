# frozen_string_literal: true

# OpenRouter Configuration
# OpenRouter uses the OpenAI SDK with a custom base URL
# No separate gem required - just configure the OpenAI client

module OpenRouter
  class Configuration
    attr_accessor :api_key, :site_url, :site_name

    def initialize
      @api_key = ENV["OPENROUTER_API_KEY"]
      @site_url = ENV["APP_URL"] || "https://fintr.app"
      @site_name = "Fintr AI"
    end
  end

  class << self
    def configuration
      @configuration ||= Configuration.new
    end

    def configure
      yield(configuration)
    end

    def api_key
      configuration.api_key
    end

    def site_url
      configuration.site_url
    end

    def site_name
      configuration.site_name
    end
  end
end

# Configure OpenRouter
OpenRouter.configure do |config|
  config.api_key = ENV["OPENROUTER_API_KEY"]
  config.site_url = ENV["APP_URL"] || "https://fintr.app"
  config.site_name = "Fintr AI"
end

Rails.logger.info "[OpenRouter] Configuration loaded for site: #{OpenRouter.site_name}"
