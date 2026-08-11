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

    context "with invalid color" do
      subject(:call_operation) do
        operation.call(space_id: space.id, name: "Invalid", color: "red")
      end

      it { is_expected.to be_failure }
    end
  end
end
