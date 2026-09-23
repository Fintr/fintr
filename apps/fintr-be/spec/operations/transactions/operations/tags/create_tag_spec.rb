# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Tags::CreateTag do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }

  describe "#call" do
    context "with valid parameters" do
      subject(:call_operation) do
        operation.call(space_id: space.id, name: "Japan 2026", color: "#00897B")
      end

      it { is_expected.to be_success }

      it "creates a tag" do
        expect { call_operation }.to change(Transactions::Tag, :count).by(1)
      end

      it "sets attributes correctly" do
        tag = call_operation.value!

        expect(tag.name).to eq("Japan 2026")
        expect(tag.color).to eq("#00897B")
        expect(tag.space_id).to eq(space.id)
      end
    end

    context "with a client-provided id" do
      let(:client_id) { SecureRandom.uuid }

      subject(:call_operation) do
        operation.call(space_id: space.id, name: "Offline Tag", id: client_id)
      end

      it { is_expected.to be_success }

      it "persists the client-provided id" do
        expect(call_operation.value!.id).to eq(client_id)
      end
    end

    context "with a style preset key and a paid subscription" do
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

      subject(:call_operation) do
        operation.call(
          space_id: space.id,
          name: "Japan 2026",
          style_preset_key: "japan-vacation",
        )
      end

      it { is_expected.to be_success }

      it "stores the preset key on the tag" do
        expect(call_operation.value!.style_preset_key).to eq("japan-vacation")
      end
    end

    context "with a style preset key and no paid subscription" do
      subject(:call_operation) do
        operation.call(
          space_id: space.id,
          name: "Japan 2026",
          style_preset_key: "japan-vacation",
        )
      end

      it { is_expected.to be_failure }
    end

    context "with invalid color" do
      subject(:call_operation) do
        operation.call(space_id: space.id, name: "Invalid", color: "red")
      end

      it { is_expected.to be_failure }
    end
  end
end
