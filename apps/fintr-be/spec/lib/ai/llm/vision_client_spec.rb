# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Llm::VisionClient do
  describe ".provider" do
    it "returns openai when AI_VISION_PROVIDER=openai" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openai")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return(nil)

      expect(described_class.provider).to eq("openai")
    end

    it "returns openrouter when AI_VISION_PROVIDER=openrouter and OPENROUTER_API_KEY set" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openrouter")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return("sk-or-xxx")

      expect(described_class.provider).to eq("openrouter")
    end

    it "returns openrouter when OPENROUTER_API_KEY set and AI_VISION_PROVIDER unset" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return(nil)
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return("sk-or-xxx")

      expect(described_class.provider).to eq("openrouter")
    end

    it "returns openai when OPENROUTER_API_KEY blank and AI_VISION_PROVIDER unset" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return(nil)
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return(nil)

      expect(described_class.provider).to eq("openai")
    end
  end

  describe ".model" do
    it "returns AI_VISION_MODEL when set" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openai")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return(nil)
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return("custom/model")

      expect(described_class.model).to eq("custom/model")
    end

    it "returns gpt-4o for openai when AI_VISION_MODEL unset" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openai")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return(nil)
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return(nil)

      expect(described_class.model).to eq("gpt-4o")
    end

    it "returns google/gemini-2.5-flash-lite for openrouter when AI_VISION_MODEL unset" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openrouter")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return("sk-or-xxx")
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return(nil)

      expect(described_class.model).to eq("google/gemini-2.5-flash-lite")
    end
  end

  describe ".openrouter_chat_extras" do
    it "returns latency routing when openrouter is active" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openrouter")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return("sk-or-xxx")

      expect(described_class.openrouter_chat_extras).to eq(
        provider: {
          sort: "latency"
        },
      )
    end

    it "returns empty hash for openai provider" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openai")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return(nil)

      expect(described_class.openrouter_chat_extras).to eq({})
    end
  end

  describe ".client" do
    it "builds OpenAI client when provider is openai" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openai")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return(nil)
      allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("sk-openai")

      expect(OpenAI::Client).to receive(:new).with(
        access_token: "sk-openai",
        request_timeout: 12,
      )

      described_class.client
    end

    it "builds OpenRouter client when provider is openrouter" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_PROVIDER").and_return("openrouter")
      allow(ENV).to receive(:[]).with("OPENROUTER_API_KEY").and_return("sk-or-xxx")
      allow(ENV).to receive(:fetch).with("OPENROUTER_API_KEY").and_return("sk-or-xxx")

      expect(OpenAI::Client).to receive(:new).with(
        access_token: "sk-or-xxx",
        uri_base: "https://openrouter.ai/api",
        request_timeout: 12,
      )

      described_class.client
    end
  end
end
