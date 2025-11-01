# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Conversations::CreateConversation, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:params) do
    {
      user_id: user.id,
      space_id: space.id,
      title: "Test Conversation"
    }
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
      expect(result.value!).to eq(params)
    end

    it "fails without user_id" do
      params_without_user_id = params.except(:user_id)
      result = operation.validate(params: params_without_user_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:user_id)
    end

    it "fails without space_id" do
      params_without_space_id = params.except(:space_id)
      result = operation.validate(params: params_without_space_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails without title" do
      params_without_title = params.except(:title)
      result = operation.validate(params: params_without_title)
      expect(result).to be_failure
      expect(result.failure).to have_key(:title)
    end

    it "fails with invalid user_id type" do
      params_with_invalid_user_id = params.merge(user_id: 123)
      result = operation.validate(params: params_with_invalid_user_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:user_id)
    end

    it "fails with invalid space_id type" do
      params_with_invalid_space_id = params.merge(space_id: 123)
      result = operation.validate(params: params_with_invalid_space_id)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid title type" do
      params_with_invalid_title = params.merge(title: 123)
      result = operation.validate(params: params_with_invalid_title)
      expect(result).to be_failure
      expect(result.failure).to have_key(:title)
    end
  end

  describe "#call" do
    context "when OpenAI conversation creation succeeds" do
      let(:openai_response) { { "id" => "conv_123" } }
      let(:openai_client) { instance_double(OpenAI::Client) }

      before do
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:conversations).and_return(
          instance_double(OpenAI::Conversations, create: openai_response)
        )
      end

      it "creates a conversation in the database" do
        expect { operation.call(params) }.to change(Ai::Conversation, :count).by(1)
      end

      it "creates conversation with correct attributes" do
        result = operation.call(params)
        conversation = Ai::Conversation.last

        expect(conversation.user_id).to eq(user.id)
        expect(conversation.space_id).to eq(space.id)
        expect(conversation.title).to eq("Test Conversation")
        expect(conversation.openai_conversation_id).to eq("conv_123")
      end

      it "returns the created conversation" do
        result = operation.call(params)
        expect(result).to be_success
        expect(result.value!).to be_a(Ai::Conversation)
        expect(result.value!.title).to eq("Test Conversation")
      end

      it "calls OpenAI with correct parameters" do
        operation.call(params)

        expect(openai_client.conversations).to have_received(:create).with(
          parameters: {
            metadata: { topic: "Test Conversation" }
          }
        )
      end
    end

    context "when OpenAI conversation creation fails" do
      let(:openai_client) { instance_double(OpenAI::Client) }
      let(:error_message) { "OpenAI API error" }

      before do
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:conversations).and_raise(StandardError.new(error_message))
        allow(Rails.logger).to receive(:error)
      end

      it "does not create a conversation in the database" do
        expect { operation.call(params) }.not_to change(Ai::Conversation, :count)
      end

      it "logs the error" do
        operation.call(params)

        expect(Rails.logger).to have_received(:error).with(
          "[CREATE_OPENAI_CONVERSATION] OpenAI Conversation Creation Error: #{error_message}"
        )
      end

      it "returns failure with OpenAI error" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to eq({ openai_error: error_message })
      end
    end

    context "when database conversation creation fails" do
      let(:openai_response) { { "id" => "conv_123" } }
      let(:openai_client) { instance_double(OpenAI::Client) }

      before do
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:conversations).and_return(
          instance_double(OpenAI::Conversations, create: openai_response)
        )
        allow_any_instance_of(Ai::Conversation).to receive(:save).and_return(false)
        allow_any_instance_of(Ai::Conversation).to receive(:errors).and_return(
          instance_double(ActiveModel::Errors, full_messages: ["Title can't be blank"])
        )
      end

      it "does not create a conversation in the database" do
        expect { operation.call(params) }.not_to change(Ai::Conversation, :count)
      end

      it "returns failure with validation errors" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to eq(["Title can't be blank"])
      end
    end

    context "with nil title" do
      let(:params_with_nil_title) { params.merge(title: nil) }

      it "uses default title in OpenAI call" do
        openai_response = { "id" => "conv_123" }
        openai_client = instance_double(OpenAI::Client)

        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:conversations).and_return(
          instance_double(OpenAI::Conversations, create: openai_response)
        )

        operation.send(:create_openai_conversation, params: params_with_nil_title)

        expect(openai_client.conversations).to have_received(:create).with(
          parameters: {
            metadata: { topic: "New Conversation" }
          }
        )
      end
    end
  end

  describe "private methods" do
    describe "#create_openai_conversation" do
      let(:openai_response) { { "id" => "conv_123" } }
      let(:openai_client) { instance_double(OpenAI::Client) }

      before do
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:conversations).and_return(
          instance_double(OpenAI::Conversations, create: openai_response)
        )
      end

      it "creates OpenAI conversation and returns ID" do
        result = operation.send(:create_openai_conversation, params: params)

        expect(result).to be_success
        expect(result.value!).to eq("conv_123")
      end

      it "calls OpenAI with correct parameters" do
        operation.send(:create_openai_conversation, params: params)

        expect(openai_client.conversations).to have_received(:create).with(
          parameters: {
            metadata: { topic: "Test Conversation" }
          }
        )
      end
    end

    describe "#create_database_conversation" do
      let(:openai_conversation_id) { "conv_123" }

      it "creates conversation with correct attributes" do
        result = operation.send(:create_database_conversation, params: params, openai_conversation_id: openai_conversation_id)

        expect(result).to be_success
        conversation = result.value!
        expect(conversation).to be_a(Ai::Conversation)
        expect(conversation.user_id).to eq(user.id)
        expect(conversation.space_id).to eq(space.id)
        expect(conversation.title).to eq("Test Conversation")
        expect(conversation.openai_conversation_id).to eq(openai_conversation_id)
      end

      it "returns failure when conversation cannot be saved" do
        allow_any_instance_of(Ai::Conversation).to receive(:save).and_return(false)
        allow_any_instance_of(Ai::Conversation).to receive(:errors).and_return(
          instance_double(ActiveModel::Errors, full_messages: ["Title can't be blank"])
        )

        result = operation.send(:create_database_conversation, params: params, openai_conversation_id: openai_conversation_id)

        expect(result).to be_failure
        expect(result.failure).to eq(["Title can't be blank"])
      end
    end
  end
end
