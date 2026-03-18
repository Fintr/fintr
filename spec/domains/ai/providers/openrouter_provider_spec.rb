# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Providers::OpenrouterProvider do
  let(:mock_client) { double("OpenAI::Client") } # rubocop:disable RSpec/VerifiedDoubles
  let(:provider) { described_class.new(client: mock_client) }

  describe '#chat' do
    let(:messages) { [{ role: 'user', content: 'Hello' }] }
    let(:model) { 'openai/gpt-4o-mini' }
    let(:raw_response) do
      {
        'choices' => [
          {
            'message' => {
              'content' => 'Hello! How can I help you?',
              'role' => 'assistant'
            }
          }
        ]
      }
    end

    context 'when successful' do
      before do
        allow(mock_client).to receive(:chat).with(parameters: hash_including(model: model)).and_return(raw_response)
      end

      it 'returns content and role' do
        result = provider.chat(messages: messages, model: model)
        expect(result).to eq(
          content: 'Hello! How can I help you?',
          role: 'assistant',
        )
      end

      it 'calls the client with parameters' do
        provider.chat(messages: messages, model: model, temperature: 0.5)

        expect(mock_client).to have_received(:chat).with(
          parameters: hash_including(
            model: model,
            temperature: 0.5,
          ),
        )
      end
    end

    context 'when streaming' do
      it 'passes a stream proc to client chat' do
        stream_proc = proc { |_delta, _chunk| }
        allow(mock_client).to receive(:chat) do |args|
          expect(args[:parameters][:stream]).to be_a(Proc)
          args[:parameters][:stream].call({ 'choices' => [{ 'delta' => { 'content' => 'Hi' } }] })
        end

        provider.chat(messages: messages, model: model, stream: stream_proc)

        expect(mock_client).to have_received(:chat).with(
          parameters: hash_including(stream: kind_of(Proc)),
        )
      end
    end

    context 'when client raises' do
      before do
        allow(mock_client).to receive(:chat).and_raise(StandardError.new('API Error'))
      end

      it 'raises ProviderError' do
        expect {
          provider.chat(messages: messages, model: model)
        }.to raise_error(Ai::Providers::ProviderError, /API Error/)
      end
    end
  end

  describe '#embeddings' do
    let(:text) { 'test text' }
    let(:response) do
      {
        'data' => [
          { 'embedding' => [0.1, 0.2, 0.3] }
        ]
      }
    end

    before do
      allow(mock_client).to receive(:embeddings) do |**kwargs|
        response
      end
    end

    it 'returns embeddings' do
      result = provider.embeddings(text: text)
      expect(result).to eq([[0.1, 0.2, 0.3]])
    end
  end

  describe '#healthy?' do
    context 'when API is accessible' do
      before do
        allow(mock_client).to receive(:models).and_return(double("ModelsResponse", list: [])) # rubocop:disable RSpec/VerifiedDoubles
      end

      it 'returns true' do
        expect(provider.healthy?).to be true
      end
    end

    context 'when API is not accessible' do
      before do
        allow(mock_client).to receive(:models).and_raise(StandardError.new('Connection failed'))
      end

      it 'returns false' do
        expect(provider.healthy?).to be false
      end
    end
  end
end
