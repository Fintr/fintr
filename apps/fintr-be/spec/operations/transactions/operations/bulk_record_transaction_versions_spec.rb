# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::BulkRecordTransactionVersions do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Groceries") }

  describe "#call" do
    it "records create versions for bulk-imported transactions" do
      transaction = create(
        :expense_transaction,
        user:,
        space:,
        account:,
        category:,
        amount: Money.from_amount(100, "PHP")
      )

      Transactions::TransactionVersion.delete_all

      result = described_class.new.call(
        transactions: [transaction],
        event: "create",
        whodunnit: user.id,
        cause: "repeat_series_create",
        operation: "Transactions::Operations::CreateRepeatTransactions"
      )

      expect(result).to be_success
      expect(result.value!).to eq(1)

      version = Transactions::TransactionVersion.last
      expect(version.item_id).to eq(transaction.id)
      expect(version.item_type).to eq("Transactions::Transaction")
      expect(version.event).to eq("create")
      expect(version.whodunnit).to eq(user.id)
      expect(version.cause).to eq("repeat_series_create")
      expect(version.operation).to eq("Transactions::Operations::CreateRepeatTransactions")
      expect(version.space_id).to eq(space.id)
    end

    it "records update versions for backfill-style snapshots" do
      transaction = create(
        :expense_transaction,
        user:,
        space:,
        account:,
        category:,
        amount: Money.from_amount(100, "PHP")
      )

      Transactions::TransactionVersion.delete_all

      result = described_class.new.call(
        transactions: [transaction],
        event: "update",
        whodunnit: user.id,
        cause: "backfill",
        operation: "db:migrate:create_transaction_versions"
      )

      expect(result).to be_success

      version = Transactions::TransactionVersion.find_by!(cause: "backfill")
      expect(version.event).to eq("update")
      expect(version.object_changes).to be_present
    end
  end
end
