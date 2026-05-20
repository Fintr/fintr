# frozen_string_literal: true

require "rails_helper"

RSpec.describe Loans::Operations::UpdateLoan do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space: space, name: "Test Account") }
  let(:entity) { create(:entity, space: space, entity_type: "loan", full_name: "Original Lender") }
  let!(:loan) do
    create(
      :loan,
      user: user,
      space: space,
      entity: entity,
      account: account,
      description: "Original note"
    )
  end

  let(:base_params) do
    {
      user_id: user.id.to_s,
      space_id: space.id.to_s,
      id: loan.id.to_s,
    }
  end

  describe "#call" do
    context "when updating description only" do
      let(:params) { base_params.merge(description: "Updated note") }

      it "returns success" do
        result = operation.call(params)
        expect(result).to be_success
      end

      it "updates the loan description" do
        operation.call(params)
        expect(loan.reload.description).to eq("Updated note")
      end

      it "does not change the entity" do
        operation.call(params)
        expect(loan.reload.entity_id).to eq(entity.id)
      end
    end

    context "when updating entity only" do
      let(:params) { base_params.merge(entity_name: "New Lender") }

      it "returns success" do
        result = operation.call(params)
        expect(result).to be_success
      end

      it "updates the loan entity" do
        operation.call(params)
        expect(loan.reload.entity.full_name).to eq("New Lender")
      end

      it "does not change the description" do
        operation.call(params)
        expect(loan.reload.description).to eq("Original note")
      end
    end

    context "when updating entity and description" do
      let(:params) do
        base_params.merge(
          entity_name: "Another Lender",
          description: "Combined update"
        )
      end

      it "updates both fields" do
        operation.call(params)
        loan.reload
        expect(loan.entity.full_name).to eq("Another Lender")
        expect(loan.description).to eq("Combined update")
      end
    end

    context "when loan does not exist" do
      let(:params) { base_params.merge(id: "missing-id", description: "x") }

      it "returns failure" do
        result = operation.call(params)
        expect(result).to be_failure
      end

      it "returns id not found error" do
        result = operation.call(params)
        expect(result.failure).to eq(id: "not found")
      end
    end

    context "when loan belongs to another space" do
      let(:other_space) { create(:personal_space) }
      let(:other_loan) { create(:loan, space: other_space, user: user) }
      let(:params) do
        base_params.merge(
          id: other_loan.id.to_s,
          description: "Should not apply"
        )
      end

      it "returns failure" do
        result = operation.call(params)
        expect(result).to be_failure
      end
    end

    context "when neither entity nor description is provided" do
      let(:params) { base_params }

      it "returns failure" do
        result = operation.call(params)
        expect(result).to be_failure
      end
    end
  end
end
