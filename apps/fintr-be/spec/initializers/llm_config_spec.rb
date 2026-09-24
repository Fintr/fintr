# frozen_string_literal: true

require "rails_helper"

RSpec.describe LlmConfig do
  describe ".agent_provider" do
    it "returns gemini when LLM_AGENT_PROVIDER is gemini" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("LLM_AGENT_PROVIDER").and_return("gemini")

      expect(described_class.agent_provider).to eq("gemini")
    end

    it "returns gemini when GEMINI_API_KEY is set and the provider is unset" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("LLM_AGENT_PROVIDER").and_return(nil)
      allow(ENV).to receive(:[]).with("GEMINI_API_KEY").and_return("test-key")

      expect(described_class.agent_provider).to eq("gemini")
    end

    it "returns openrouter when LLM_AGENT_PROVIDER is openrouter" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("LLM_AGENT_PROVIDER").and_return("openrouter")

      expect(described_class.agent_provider).to eq("openrouter")
    end
  end
end
