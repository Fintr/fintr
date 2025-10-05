# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Embeddings::PrepareContent, type: :operation do
  describe "#call" do
    let(:operation) { described_class.new }
    let(:user) { create(:user) }
    let(:space) { create(:personal_space) }
    let(:account) { create(:account, space: space) }
    let(:category) { create(:category, space: space) }

    context "when embeddable is a Transactions::Expense" do
      let(:transaction) { create(:expense_transaction, space: space, account: account, category: category, description: "Coffee purchase", amount: Money.from_amount(5.00, "PHP"), date: Date.parse("2024-01-15")) }

      it "builds transaction content with negative amount display" do
        result = operation.call(embeddable: transaction)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Transaction: Coffee purchase, " \
          "Amount: -₱5.00, " \
          "Category: #{category.name}, " \
          "Account: #{account.name}, " \
          "Date: January 15, 2024, " \
          "Type: Transactions::Expense, " \
          "Space: #{space.name}"
        )
      end
    end

    context "when embeddable is a Transactions::Income" do
      let(:transaction) { create(:income_transaction, space: space, account: account, category: category, description: "Salary payment", amount: Money.from_amount(3000.00, "PHP"), date: Date.parse("2024-01-15")) }

      it "builds transaction content with positive amount display" do
        result = operation.call(embeddable: transaction)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Transaction: Salary payment, " \
          "Amount: +₱3,000.00, " \
          "Category: #{category.name}, " \
          "Account: #{account.name}, " \
          "Date: January 15, 2024, " \
          "Type: Transactions::Income, " \
          "Space: #{space.name}"
        )
      end
    end

    context "when embeddable is a Transactions::Transfer" do
      let(:to_account) { create(:account, space: space) }
      let(:transfer) { create(:transfer, space: space, from_account: account, to_account: to_account, description: "Monthly savings transfer", amount: Money.from_amount(1000.00, "PHP"), transaction_cost: Money.from_amount(0.00, "PHP"), date: Date.parse("2024-01-15")) }

      it "builds transfer content" do
        result = operation.call(embeddable: transfer)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Transfer: Monthly savings transfer, " \
          "Amount: ₱1,000.00, " \
          "From Account: #{account.name}, " \
          "To Account: #{to_account.name}, " \
          "Transaction Cost: ₱0.00, " \
          "Date: January 15, 2024, " \
          "Type: Transfer, " \
          "Space: #{space.name}"
        )
      end
    end

    context "when embeddable is an unsupported type" do
      let(:unsupported_object) { "some string" }

      it "returns a failure with unsupported type message" do
        result = operation.call(embeddable: unsupported_object)

        expect(result).to be_failure
        expect(result.failure).to eq(embeddable_type: "unsupported type")
      end
    end
  end
end
