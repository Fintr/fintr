# frozen_string_literal: true

require "rails_helper"

RSpec.describe SubscriptionsChannel, type: :channel do
  before do
    stub_connection
    allow(Rails.logger).to receive(:info)
  end

  describe "#subscribed" do
    context "when space_id is provided" do
      let(:space_id) { SecureRandom.uuid }

      it "successfully subscribes" do
        subscribe(space_id: space_id)

        expect(subscription).to be_confirmed
      end

      it "streams from the correct channel" do
        subscribe(space_id: space_id)

        expect(subscription).to have_stream_from("subscriptions:#{space_id}")
      end

      it "logs the subscription" do
        expect(Rails.logger).to receive(:info).with(
          "Subscribed to subscriptions channel for space #{space_id}"
        )

        subscribe(space_id: space_id)
      end
    end

    context "when space_id is not provided" do
      it "rejects the subscription" do
        subscribe

        expect(subscription).to be_rejected
      end

      it "does not log subscription" do
        expect(Rails.logger).not_to receive(:info).with(
          include("Subscribed to subscriptions channel")
        )

        subscribe
      end
    end

    context "when space_id is empty string" do
      it "rejects the subscription" do
        subscribe(space_id: "")

        expect(subscription).to be_rejected
      end
    end

    context "when space_id is nil" do
      it "rejects the subscription" do
        subscribe(space_id: nil)

        expect(subscription).to be_rejected
      end
    end
  end

  describe "#unsubscribed" do
    let(:space_id) { SecureRandom.uuid }

    before do
      subscribe(space_id: space_id)
    end

    it "logs the unsubscription" do
      expect(Rails.logger).to receive(:info).with(
        "Unsubscribed from subscriptions channel"
      )

      unsubscribe
    end
  end
end
