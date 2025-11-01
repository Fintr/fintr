# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::CreateOrganizationSpace, type: :operation do
  let(:user) { create(:user) }
  let(:reference_space) { create(:organization_space) }

  let(:valid_params) do
    {
      user_id: user.id.to_s,
      name: "My Organization",
      currency: "USD",
      reference_space_id: reference_space.id.to_s
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

      it "copies categories from reference space" do
        category1 = create(:category,
                           space: reference_space,
                           name: "Food",
                           category_type: "expense")
        category2 = create(:category,
                           space: reference_space,
                           name: "Salary",
                           category_type: "income")

        result = described_class.new.call(valid_params)

        expect(result).to be_success
        space = result.value!

        copied_categories = space.categories
        expect(copied_categories.count).to eq(2)
        expect(copied_categories.pluck(:name)).to contain_exactly("Food", "Salary")
        expect(copied_categories.find_by(name: "Food").category_type).to eq("expense")
        expect(copied_categories.find_by(name: "Salary").category_type).to eq("income")
      end

      it "copies categories with no categories in reference space" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        space = result.value!

        expect(space.categories.count).to eq(0)
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

    context "with invalid reference_space_id" do
      let(:invalid_params) { valid_params.merge(reference_space_id: "invalid") }

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { reference_space: ["not found"] })
      end
    end

    context "with missing reference_space_id" do
      let(:invalid_params) { valid_params.except(:reference_space_id) }

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
      end
    end
  end
end
