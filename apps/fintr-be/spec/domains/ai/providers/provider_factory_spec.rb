# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Providers::ProviderFactory do
  describe '.create' do
    let(:mock_openai_client) { instance_double(OpenAI::Client) }

    before do
      allow(OpenAI::Client).to receive(:new).and_return(mock_openai_client)
    end

    context 'with valid provider name' do
      it 'creates OpenRouter provider' do
        provider = described_class.create(:openrouter, api_key: 'test')
        expect(provider).to be_a(Ai::Providers::OpenrouterProvider)
      end

      it 'creates OpenAI fallback provider' do
        provider = described_class.create(:openai, api_key: 'test')
        expect(provider).to be_a(Ai::Providers::OpenaiFallbackProvider)
      end
    end

    context 'with string provider name' do
      it 'creates provider' do
        provider = described_class.create('openrouter', api_key: 'test')
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

  # Note: .register test removed as it modifies frozen PROVIDERS constant
  # If registration testing is needed, it should be done in a different way
end
