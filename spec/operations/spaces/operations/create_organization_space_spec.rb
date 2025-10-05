# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::CreateOrganizationSpace, type: :operation do
  let(:user) { create(:user) }

  let(:valid_params) do
    {
      user_id: user.id.to_s,
      name: "My Organization",
      currency: "USD"
    }
  end

  describe "#call" do
    context "with valid parameters" do
      it "successfully creates organization space" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        space = result.value!

        expect(space).to be_a(Spaces::OrganizationSpace)
        expect(space.name).to eq("My Organization")
        expect(space.currency).to eq("USD")
        expect(space.code).to be_present

        expect(user.reload.spaces).to include(space)
        expect(user.has_role?(:admin, space)).to be true
      end

      it "creates default transaction categories" do
        expect_any_instance_of(Spaces::Space).to receive(:create_default_transaction_categories)

        described_class.new.call(valid_params)
      end
    end

    context "with duplicate space name" do
      before do
        create(:space, name: "My Organization")
      end

      it "generates unique space code" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        space = result.value!
        expect(space.code).to include("my-organization")
      end
    end

    context "with invalid parameters" do
      let(:invalid_params) { valid_params.merge(name: nil) }

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
      end
    end

    context "with invalid user_id" do
      let(:invalid_params) { valid_params.merge(user_id: "invalid") }

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
      end
    end
  end
end
