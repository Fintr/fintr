# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ai::Providers::BaseProvider do
  let(:provider) { described_class.new }

  describe '#chat' do
    it 'raises NotImplementedError' do
      expect {
        provider.chat(messages: [], model: 'test')
      }.to raise_error(NotImplementedError)
    end
  end

  describe '#embeddings' do
    it 'raises NotImplementedError' do
      expect {
        provider.embeddings(text: 'test')
      }.to raise_error(NotImplementedError)
    end
  end

  describe '#healthy?' do
    it 'raises NotImplementedError' do
      expect {
        provider.healthy?
      }.to raise_error(NotImplementedError)
    end
  end
end
