# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Providers::ProviderFactory do
  describe '.create' do
    context 'with valid provider name' do
      it 'creates OpenRouter provider' do
        provider = described_class.create(:openrouter)
        expect(provider).to be_a(Ai::Providers::OpenrouterProvider)
      end

      it 'creates OpenAI fallback provider' do
        provider = described_class.create(:openai)
        expect(provider).to be_a(Ai::Providers::OpenaiFallbackProvider)
      end
    end

    context 'with string provider name' do
      it 'creates provider' do
        provider = described_class.create('openrouter')
        expect(provider).to be_a(Ai::Providers::OpenrouterProvider)
      end
    end

    context 'with invalid provider name' do
      it 'raises UnknownProviderError' do
        expect {
          described_class.create(:unknown)
        }.to raise_error(Ai::Providers::UnknownProviderError, /unknown/)
      end
    end
  end

  describe '.register' do
    let(:mock_provider_class) { Class.new(Ai::Providers::BaseProvider) }

    it 'registers new provider' do
      described_class.register(:custom, mock_provider_class)
      
      provider = described_class.create(:custom)
      expect(provider).to be_a(mock_provider_class)
    end
  end
end
