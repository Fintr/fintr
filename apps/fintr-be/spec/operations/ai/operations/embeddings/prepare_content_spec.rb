# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Embeddings::PrepareContent, type: :operation do
  describe "#call" do
    let(:operation) { described_class.new }
    let(:user) { create(:user) }
    let(:space) { create(:personal_space) }
    let(:account) { create(:account, space: space) }
    let(:category) { create(:category, :expense, space: space) }

    context "when embeddable is a Transactions::Expense" do
      let(:transaction) do
        create(
          :expense_transaction,
          space: space,
          account: account,
          category: category,
          description: "Coffee purchase",
          amount: Money.from_amount(5.00, "PHP"),
          date: Date.parse("2024-01-15")
        )
      end

      it "builds transaction content with negative amount display" do
        result = operation.call(embeddable: transaction)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Coffee purchase. -₱5.00 expense in #{category.name} via #{account.name} on January 15, 2024."
        )
      end
    end

    context "when embeddable is a Transactions::Expense with a subcategory" do
      let(:subcategory) { create(:category, :subcategory, parent: category) }
      let(:transaction) do
        create(
          :expense_transaction,
          space: space,
          account: account,
          category: category,
          subcategory: subcategory,
          description: "Coffee purchase",
          amount: Money.from_amount(5.00, "PHP"),
          date: Date.parse("2024-01-15")
        )
      end

      it "includes the subcategory in the category label" do
        result = operation.call(embeddable: transaction)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Coffee purchase. -₱5.00 expense in #{category.name}, #{subcategory.name} " \
          "via #{account.name} on January 15, 2024."
        )
      end
    end

    context "when embeddable is a Transactions::Income" do
      let(:category) { create(:category, space: space) }
      let(:transaction) do
        create(
          :income_transaction,
          space: space,
          account: account,
          category: category,
          description: "Salary payment",
          amount: Money.from_amount(3000.00, "PHP"),
          date: Date.parse("2024-01-15")
        )
      end

      it "builds transaction content with positive amount display" do
        result = operation.call(embeddable: transaction)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Salary payment. +₱3,000.00 income in #{category.name} via #{account.name} on January 15, 2024."
        )
      end
    end

    context "when embeddable is a Transactions::Transfer" do
      let(:to_account) { create(:account, space: space) }
      let(:transfer) do
        create(
          :transfer,
          space: space,
          from_account: account,
          to_account: to_account,
          description: "Monthly savings transfer",
          amount: Money.from_amount(1000.00, "PHP"),
          transaction_cost: Money.from_amount(0.00, "PHP"),
          date: Date.parse("2024-01-15")
        )
      end

      it "builds transfer content" do
        result = operation.call(embeddable: transfer)

        expect(result).to be_success
        expect(result.value!).to eq(
          "Monthly savings transfer. ₱1,000.00 transfer from #{account.name} to #{to_account.name} " \
          "with ₱0.00 fee on January 15, 2024."
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
