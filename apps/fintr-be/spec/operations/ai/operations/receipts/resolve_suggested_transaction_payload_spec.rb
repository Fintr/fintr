# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Receipts::ResolveSuggestedTransactionPayload, type: :operation do
  subject(:operation) { described_class.new }

  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:, name: "Cash") }
  let(:category) { create(:category, :expense, space:, name: "Groceries") }

  let(:base_payload) do
    {
      amount: 25.00,
      date: Date.current,
      transaction_type: "expense",
      category_name: category.name,
      account_name: account.name,
      description: "Test receipt",
      schedule_type: "one_time"
    }
  end

  let(:valid_params) do
    {
      space_id: space.id,
      suggested_transaction_payload: base_payload
    }
  end

  describe "#call" do
    context "when category and account names already exist" do
      it "returns the payload unchanged" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to eq(base_payload)
      end
    end

    context "when category name differs only by case" do
      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(category_name: category.name.upcase)
        }
      end

      it "normalizes the category name to the stored value" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:category_name]).to eq(category.name)
      end
    end

    context "when category does not exist" do
      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(category_name: "Non-existent Category")
        }
      end

      it "falls back to the first expense root category in the space" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:category_name]).to eq(category.name)
      end
    end

    context "when account name differs only by case" do
      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(account_name: account.name.upcase)
        }
      end

      it "normalizes the account name to the stored value" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:account_name]).to eq(account.name)
      end
    end

    context "when account does not exist" do
      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(account_name: "Non-existent Account")
        }
      end

      it "falls back to the first account in the space" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:account_name]).to eq(account.name)
      end
    end

    context "when the space has no expense categories" do
      before { category.destroy! }

      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(category_name: "Missing Category")
        }
      end

      it "returns an expected category not found failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to include(category_name: "not found", expected: true)
      end
    end

    context "when the space has no accounts" do
      before { account.discard }

      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(account_name: "Missing Account")
        }
      end

      it "returns an expected account not found failure" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure).to include(account_name: "not found", expected: true)
      end
    end

    context "when a saved merchant alias exists for the scanned receipt merchant" do
      let!(:merchant_entity) do
        create(:entity, space:, entity_type: "transaction", full_name: "Dairy Queen")
      end

      before do
        create(
          :merchant_alias,
          space:,
          entity: merchant_entity,
          scanned_name: "corporation a",
        )
      end

      let(:valid_params) do
        {
          space_id: space.id,
          suggested_transaction_payload: base_payload.merge(
            description: "CORPORATION A",
            receipt_merchant_detected: "CORPORATION A",
          ),
        }
      end

      it "resolves entity_name from the saved alias" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:entity_name]).to eq("Dairy Queen")
      end
    end
  end
end
