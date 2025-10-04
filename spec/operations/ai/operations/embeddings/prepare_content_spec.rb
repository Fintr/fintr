# frozen_string_literal: true

require "spec_helper"

RSpec.describe Ai::Operations::Embeddings::PrepareContent do
  describe "#call" do
    let(:operation) { described_class.new }

    context "when embeddable is a Transactions::Expense" do
      let(:space) { instance_double(Spaces::Space, name: "Test Space") }
      let(:account) { instance_double(Transactions::Account, name: "Test Account") }
      let(:category) { instance_double(Transactions::Category, name: "Test Category") }
      let(:transaction) do
        instance_double(Transactions::Expense,
                        type: "Transactions::Expense",
                        description: "Coffee purchase",
                        amount: instance_double(Money, format: "₱5.00"),
                        category:,
                        account:,
                        date: Date.parse("2024-01-15"),
                        space:)
      end

      it "builds transaction content with negative amount display" do
        result = operation.call(embeddable: transaction)

        expect(result).to eq(
          "Transaction: Coffee purchase, " \
          "Amount: -₱5.00, " \
          "Category: Test Category, " \
          "Account: Test Account, " \
          "Date: January 15, 2024, " \
          "Type: Transactions::Expense, " \
          "Space: Test Space"
        )
      end
    end

    context "when embeddable is a Transactions::Income" do
      let(:space) { instance_double(Spaces::Space, name: "Test Space") }
      let(:account) { instance_double(Transactions::Account, name: "Test Account") }
      let(:category) { instance_double(Transactions::Category, name: "Test Category") }
      let(:transaction) do
        instance_double(Transactions::Income,
                        type: "Transactions::Income",
                        description: "Salary payment",
                        amount: instance_double(Money, format: "₱3,000.00"),
                        category:,
                        account:,
                        date: Date.parse("2024-01-15"),
                        space:)
      end

      it "builds transaction content with positive amount display" do
        result = operation.call(embeddable: transaction)

        expect(result).to eq(
          "Transaction: Salary payment, " \
          "Amount: +₱3,000.00, " \
          "Category: Test Category, " \
          "Account: Test Account, " \
          "Date: January 15, 2024, " \
          "Type: Transactions::Income, " \
          "Space: Test Space"
        )
      end
    end

    context "when embeddable is a Transactions::Transfer" do
      let(:space) { instance_double(Spaces::Space, name: "Test Space") }
      let(:from_account) { instance_double(Transactions::Account, name: "Checking Account") }
      let(:to_account) { instance_double(Transactions::Account, name: "Savings Account") }
      let(:transfer) do
        instance_double(Transactions::Transfer,
                        description: "Monthly savings transfer",
                        amount: instance_double(Money, format: "₱1,000.00"),
                        from_account:,
                        to_account:,
                        transaction_cost: instance_double(Money, format: "₱0.00"),
                        date: Date.parse("2024-01-15"),
                        space:)
      end

      it "builds transfer content" do
        result = operation.call(embeddable: transfer)

        expect(result).to eq(
          "Transfer: Monthly savings transfer, " \
          "Amount: ₱1,000.00, " \
          "From Account: Checking Account, " \
          "To Account: Savings Account, " \
          "Transaction Cost: ₱0.00, " \
          "Date: January 15, 2024, " \
          "Type: Transfer, " \
          "Space: Test Space"
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
