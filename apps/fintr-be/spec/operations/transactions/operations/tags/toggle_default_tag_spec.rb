# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Tags::ToggleDefaultTag do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let!(:tag) { create(:transaction_tag, space:, name: "Japan 2026") }
  let!(:other_tag) { create(:transaction_tag, space:, name: "Work") }

  describe "#call" do
    context "when tag is not default" do
      subject(:call_operation) { operation.call(space_id: space.id, id: tag.id) }

      it { is_expected.to be_success }

      it "sets the tag as default" do
        call_operation
        expect(tag.reload.is_default?).to be(true)
      end

      it "clears default on other tags in the space" do
        other_tag.update!(is_default: true)

        call_operation

        expect(other_tag.reload.is_default?).to be(false)
        expect(tag.reload.is_default?).to be(true)
      end
    end

    context "when tag is already default" do
      subject(:call_operation) { operation.call(space_id: space.id, id: tag.id) }

      before { tag.update!(is_default: true) }

      it { is_expected.to be_success }

      it "unsets default" do
        call_operation
        expect(tag.reload.is_default?).to be(false)
      end
    end
  end
end
