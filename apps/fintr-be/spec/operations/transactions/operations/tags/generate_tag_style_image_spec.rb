# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Tags::GenerateTagStyleImage do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let!(:subscription_plan) { create(:subscription_plan, slug: "premium-#{SecureRandom.hex(4)}") }
  let!(:space_subscription) do
    create(
      :space_subscription,
      space:,
      subscription_plan:,
      status: :active,
      subscription_type: :paid,
    )
  end
  let!(:tag) { create(:transaction_tag, space:, name: "Japan 2026") }

  let(:b64_png) { Base64.strict_encode64("fake-image-bytes") }

  before do
    allow(Ai::Llm::ImageClient).to receive(:generate).and_return(b64_png)
  end

  describe "#call" do
  subject(:call_operation) do
      operation.call(
        space_id: space.id,
        id: tag.id,
        prompt: "Autumn in Japan with momiji and a torii gate",
      )
    end

    context "with a paid subscription" do
      it { is_expected.to be_success }

      it "attaches a style image to the tag" do
        call_operation

        expect(tag.reload.style_image).to be_attached
      end

      it "calls OpenRouter image generation" do
        call_operation

        expect(Ai::Llm::ImageClient).to have_received(:generate).with(
          prompt: include("Autumn in Japan with momiji and a torii gate"),
        )
      end
    end

    context "without a paid subscription" do
      before { space_subscription.update!(status: :inactive) }

      it { is_expected.to be_failure }

      it "returns a subscription error" do
        expect(call_operation.failure).to eq(subscription: ["Active paid subscription required"])
      end
    end

    context "when the tag does not exist" do
      subject(:call_operation) do
        operation.call(
          space_id: space.id,
          id: SecureRandom.uuid,
          prompt: "A scenic landscape",
        )
      end

      it { is_expected.to be_failure }
    end
  end
end
