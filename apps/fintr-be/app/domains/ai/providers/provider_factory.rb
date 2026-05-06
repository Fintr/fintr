# frozen_string_literal: true

module Ai
  module Providers
    # Factory for creating provider instances
    # Implements Open/Closed Principle - easy to add new providers
    class ProviderFactory
      PROVIDERS = {
        openrouter: OpenrouterProvider,
        openai: OpenaiFallbackProvider
      }.freeze

      class << self
        # Create a provider instance
        # @param provider_name [Symbol, String] Provider identifier
        # @param options [Hash] Provider-specific options
        # @return [BaseProvider]
        def create(
          provider_name,
          **options
        )
          provider_class = PROVIDERS[provider_name.to_sym]

          unless provider_class
            raise UnknownProviderError, "Unknown provider: #{provider_name}. " \
                                        "Available: #{PROVIDERS.keys.join(', ')}"
          end

          provider_class.new(**options)
        end

        # Register a new provider (Open for Extension)
        # @param name [Symbol] Provider identifier
        # @param provider_class [Class] Provider class inheriting from BaseProvider
        def register(
          name,
          provider_class
        )
          unless provider_class < BaseProvider
            raise ArgumentError, "Provider must inherit from BaseProvider"
          end

          PROVIDERS[name.to_sym] = provider_class
          Rails.logger.info "[ProviderFactory] Registered provider: #{name}"
        end

        # Check if a provider is registered
        # @param name [Symbol, String]
        # @return [Boolean]
        def registered?(name)
          PROVIDERS.key?(name.to_sym)
        end

        # List all available providers
        # @return [Array<Symbol>]
        def available
          PROVIDERS.keys
        end

        # Create provider with automatic fallback
        # @param primary [Symbol] Primary provider
        # @param fallback [Symbol] Fallback provider
        # @return [ResilientProvider]
        def create_with_fallback(
          primary: :openrouter,
          fallback: :openai
        )
          ResilientProvider.new(
            primary: create(primary),
            fallback: create(fallback),
          )
        end
      end
    end

    # Wrapper that provides automatic fallback between providers
    class ResilientProvider < BaseProvider
      def initialize(
        primary:,
        fallback:
      )
        @primary = primary
        @fallback = fallback
        @current_provider = primary
      end

      def chat(
        messages:,
        model:,
        temperature: 0.3,
        stream: nil,
        **options
      )
        attempt_with_fallback do |provider|
          provider.chat(
            messages: messages,
            model: model,
            temperature: temperature,
            stream: stream,
            **options,
          )
        end
      end

      def embeddings(
        text:,
        model: nil
      )
        attempt_with_fallback do |provider|
          provider.embeddings(
            text: text,
            model: model,
          )
        end
      end

      def healthy?
        @primary.healthy? || @fallback.healthy?
      end

      def current_provider_name
        @current_provider.name
      end

      private

      def attempt_with_fallback
        yield @current_provider
      rescue ProviderError => e
        if @current_provider == @primary && @fallback.healthy?
          Rails.logger.warn "[ResilientProvider] Primary failed, switching to fallback: #{e.message}"
          @current_provider = @fallback
          retry
        else
          raise
        end
      end
    end
  end
end
