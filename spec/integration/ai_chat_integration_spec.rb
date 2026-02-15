# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'AI Chat Integration', type: :integration do
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:conversation) { create(:ai_conversation, user: user, space: space) }

  describe 'end-to-end chat flow' do
    it 'processes a simple query through the entire pipeline' do
      # Create some test transactions
      create_list(:transaction, 5, space: space, amount_cents: 10000)

      # Setup mock provider
      mock_provider = instance_double(Ai::Providers::OpenrouterProvider)
      allow(Ai::Providers::ProviderFactory).to receive(:create).and_return(mock_provider)

      # Mock the LLM response
      allow(mock_provider).to receive(:chat).and_return({
        'choices' => [{
          'message' => {
            'content' => 'Your total spending is ₱5,000.00'
          }
        }]
      })

      # Execute the job
      result = perform_enqueued_jobs do
        Ai::AiChatJob.perform_later(
          'test-session',
          'What is my total spending?',
          space.id,
          user.id,
          conversation.id
        )
      end

      # Verify conversation was updated
      conversation.reload
      expect(conversation.conversation_messages.count).to eq(2) # user + assistant
      
      assistant_message = conversation.conversation_messages.last
      expect(assistant_message.openai_role).to eq('assistant')
      expect(assistant_message.content).to include('₱5,000.00')
    end
  end

  describe 'conversation context' do
    it 'includes previous messages in context' do
      # Add some conversation history
      conversation.add_user_message('What did I spend on food?')
      conversation.add_assistant_message('You spent ₱1,000 on food.')
      conversation.add_user_message('What about last month?')

      # Verify context builder includes history
      builder = Ai::Conversations::ContextBuilder.new(conversation_id: conversation.id)
      messages = builder.build(system_prompt: 'Test prompt', user_query: 'Test query')

      expect(messages.length).to eq(5) # system + 4 history + current
      expect(messages[0][:role]).to eq('system')
      expect(messages[1][:role]).to eq('user')
      expect(messages[2][:role]).to eq('assistant')
    end
  end

  describe 'provider fallback' do
    it 'falls back to secondary provider when primary fails' do
      primary = instance_double(Ai::Providers::OpenrouterProvider, name: 'openrouter', healthy?: false)
      fallback = instance_double(Ai::Providers::OpenaiFallbackProvider, name: 'openai', healthy?: true)
      
      allow(Ai::Providers::ProviderFactory).to receive(:create).with(:openrouter).and_return(primary)
      allow(Ai::Providers::ProviderFactory).to receive(:create).with(:openai).and_return(fallback)
      
      # Mock primary to fail
      allow(primary).to receive(:chat).and_raise(Ai::Providers::ProviderError.new('Primary failed'))
      allow(fallback).to receive(:chat).and_return({
        'choices' => [{
          'message' => { 'content' => 'Fallback response' }
        }]
      })

      resilient = Ai::Providers::ResilientProvider.new(primary: primary, fallback: fallback)
      result = resilient.chat(messages: [], model: 'test')

      expect(result.dig('choices', 0, 'message', 'content')).to eq('Fallback response')
    end
  end
end
