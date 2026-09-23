# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Tags::AssignPresetStyleImage do
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

  describe "#call" do
    subject(:call_operation) do
      operation.call(
        space_id: space.id,
        id: tag.id,
        preset_key: "japan-vacation",
      )
    end

    context "with a paid subscription" do
      it { is_expected.to be_success }

      it "stores the preset key on the tag" do
        call_operation

        expect(tag.reload.style_preset_key).to eq("japan-vacation")
      end
    end

    context "when a custom style image is already attached" do
      before do
        tag.style_image.attach(
          io: StringIO.new("fake-image-bytes"),
          filename: "tag-style.png",
          content_type: "image/png",
        )
      end

      it "replaces the custom image with the preset" do
        call_operation

        expect(tag.reload.style_image).not_to be_attached
        expect(tag.style_preset_key).to eq("japan-vacation")
      end
    end

    context "without a paid subscription" do
      before { space_subscription.update!(status: :inactive) }

      it { is_expected.to be_failure }

      it "returns a subscription error" do
        expect(call_operation.failure).to eq(subscription: ["Fintr Pro is required"])
      end
    end

    context "with an unknown preset key" do
      subject(:call_operation) do
        operation.call(
          space_id: space.id,
          id: tag.id,
          preset_key: "not-a-preset",
        )
      end

      it { is_expected.to be_failure }
    end
  end
end
