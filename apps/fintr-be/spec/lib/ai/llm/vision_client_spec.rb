# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Llm::VisionClient do
  describe ".provider" do
    it "returns openrouter" do
      expect(described_class.provider).to eq(:openrouter)
    end
  end

  describe ".model" do
    it "prefixes a bare Gemini model id for OpenRouter" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return("gemini-3.1-flash-lite")

      expect(described_class.model).to eq("google/gemini-3.1-flash-lite")
    end

    it "keeps an OpenRouter model id that already has a provider" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return("google/gemini-3.1-flash-lite")

      expect(described_class.model).to eq("google/gemini-3.1-flash-lite")
    end

    it "returns google/gemini-2.5-flash-lite when AI_VISION_MODEL is unset" do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return(nil)

      expect(described_class.model).to eq("google/gemini-2.5-flash-lite")
    end
  end

  describe ".ask" do
    let(:chat) { instance_double(RubyLLM::Chat) }
    let(:context) { instance_double(RubyLLM::Context) }
    let(:message) { instance_double(RubyLLM::Message, content: "  {\"total_amount\":\"1.00\"}  ") }
    let(:config) { instance_double(RubyLLM::Configuration) }

    before do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("AI_VISION_MODEL").and_return(nil)
      allow(ENV).to receive(:[]).with("AI_VISION_REQUEST_TIMEOUT").and_return(nil)
      allow(config).to receive(:request_timeout=)
      allow(RubyLLM).to receive(:context) do |&block|
        block.call(config)
        context
      end
      allow(context).to receive(:chat).and_return(chat)
      allow(chat).to receive(:with_temperature).and_return(chat)
      allow(chat).to receive(:with_params).and_return(chat)
      allow(chat).to receive(:ask).and_return(message)
    end

    it "returns the stripped model text" do
      result = described_class.ask(
        instructions: "Receipt OCR",
        prompt: "Extract the total",
        image: "data:image/jpeg;base64,#{Base64.strict_encode64('jpeg')}",
        max_output_tokens: 220,
      )

      expect(result).to eq("{\"total_amount\":\"1.00\"}")
    end

    it "uses an OpenRouter vision chat with a 12 second timeout" do
      described_class.ask(
        instructions: "Receipt OCR",
        prompt: "Extract the total",
        image: "data:image/jpeg;base64,#{Base64.strict_encode64('jpeg')}",
        max_output_tokens: 220,
      )

      expect(config).to have_received(:request_timeout=).with(12)
      expect(context).to have_received(:chat).with(
        model: "google/gemini-2.5-flash-lite",
        provider: :openrouter,
        assume_model_exists: true,
      )
      expect(chat).to have_received(:with_temperature).with(0.0)
      expect(chat).to have_received(:with_params).with(
        max_tokens: 220,
        provider: {
          sort: "latency"
        },
      )
    end

    it "sends the decoded receipt image as one attachment" do
      image_bytes = "\xFF\xD8\x00jpeg".b
      captured_bytes = nil
      allow(chat).to receive(:ask) do |_prompt, with:|
        captured_bytes = File.binread(with.first.path)
        RubyLLM::Content.new("Extract the total", with)
        message
      end

      described_class.ask(
        instructions: "Receipt OCR",
        prompt: "Extract the total",
        image: "data:image/jpeg;base64,#{Base64.strict_encode64(image_bytes)}",
        max_output_tokens: 220,
      )

      expect(captured_bytes).to eq(image_bytes)
    end
  end
end
