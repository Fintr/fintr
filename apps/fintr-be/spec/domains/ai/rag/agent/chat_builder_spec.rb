# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Rag::Agent::ChatBuilder do
  describe "#build" do
    it "seeds prior turns and keeps the latest user query for ask()" do
      conversation = create(:ai_conversation)
      create(
        :ai_conversation_message,
        conversation: conversation,
        openai_role: :user,
        content: "how much coffee did i spend this year?",
      )
      create(
        :ai_conversation_message,
        conversation: conversation,
        openai_role: :assistant,
        content: "You spent ₱100.00.",
      )
      create(
        :ai_conversation_message,
        conversation: conversation,
        openai_role: :user,
        content: "how much coffee did i spend last month?",
      )

      builder = described_class.new(
        conversation_id: conversation.id,
        user_query: "how much coffee did i spend last month?",
      )
      llm = builder.build

      expect(builder.pending_user_query).to eq("how much coffee did i spend last month?")
      expect(llm.messages.map(&:role)).to eq(%i[user assistant])
      expect(llm.messages.last.content).to eq("You spent ₱100.00.")
    end

    it "keeps only the most recent turns when history is long" do
      conversation = create(:ai_conversation)

      8.times do |index|
        create(
          :ai_conversation_message,
          conversation: conversation,
          openai_role: :user,
          content: "question #{index}",
        )
        create(
          :ai_conversation_message,
          conversation: conversation,
          openai_role: :assistant,
          content: "answer #{index}",
        )
      end

      create(
        :ai_conversation_message,
        conversation: conversation,
        openai_role: :user,
        content: "latest question",
      )

      builder = described_class.new(
        conversation_id: conversation.id,
        user_query: "latest question",
      )
      llm = builder.build

      expect(llm.messages.size).to eq(described_class::MAX_SEEDED_MESSAGES)
      expect(llm.messages.first.content).to eq("question 5")
      expect(llm.messages.last.content).to eq("answer 7")
    end

    it "skips history when seed_history is false" do
      conversation = create(:ai_conversation)
      create(
        :ai_conversation_message,
        conversation: conversation,
        openai_role: :user,
        content: "old question",
      )

      builder = described_class.new(
        conversation_id: conversation.id,
        user_query: "new question",
        seed_history: false,
      )
      llm = builder.build

      expect(builder.pending_user_query).to eq("new question")
      expect(llm.messages).to be_empty
    end
  end
end
