# frozen_string_literal: true

require "rails_helper"

RSpec.describe ChatChannel, type: :channel do
  let(:user) { create(:user) }
  let(:conversation_id) { "123" }

  before do
    stub_connection(current_user: user)
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:error)
  end

  describe "#subscribed" do
    context "when conversation_id is present" do
      it "subscribes to the chat channel" do
        subscribe(conversation_id: conversation_id)

        expect(subscription).to be_confirmed
      end

      it "streams from the correct channel" do
        subscribe(conversation_id: conversation_id)

        expect(subscription).to have_stream_from("chat_#{conversation_id}")
      end

      it "logs subscription attempt" do
        expect(Rails.logger).to receive(:info).with(
          "[ChatChannel] 📡 Subscription attempt for conversation_id: #{conversation_id}"
        )
        expect(Rails.logger).to receive(:info).with(
          "[ChatChannel] Current user: #{user.id}"
        )
        expect(Rails.logger).to receive(:info).with(
          match(/\[ChatChannel\] Params: .*conversation_id.*#{conversation_id}/)
        )
        expect(Rails.logger).to receive(:info).with(
          "[ChatChannel] ✅ Successfully subscribed to chat_#{conversation_id}"
        )

        subscribe(conversation_id: conversation_id)
      end
    end

    context "when conversation_id is missing" do
      it "rejects the subscription" do
        subscribe(conversation_id: nil)

        expect(subscription).to be_rejected
      end

      it "logs rejection error" do
        expect(Rails.logger).to receive(:info).with(
          "[ChatChannel] 📡 Subscription attempt for conversation_id: "
        )
        expect(Rails.logger).to receive(:error).with(
          "[ChatChannel] ⛔ Rejecting: conversation_id is missing"
        )

        subscribe(conversation_id: nil)
      end
    end

    context "when conversation_id is empty string" do
      it "rejects the subscription" do
        subscribe(conversation_id: "")

        expect(subscription).to be_rejected
      end
    end
  end

  describe "#unsubscribed" do
    it "logs unsubscription" do
      subscribe(conversation_id: conversation_id)

      expect(Rails.logger).to receive(:info).with(
        "[ChatChannel] 👋 Unsubscribed from chat channel"
      )

      unsubscribe
    end
  end
end
