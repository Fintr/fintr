# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Accounts::SaveAccount do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
  let(:operation_name) { "Transactions::Operations::Accounts::CalculateBalance" }

  describe "#call" do
    it "records a save version with cause and operation metadata" do
      account
      Transactions::AccountVersion.delete_all
      account.balance = Money.from_amount(500, "PHP")

      result = described_class.new.call(
        account:,
        cause: "transaction_calculate_balance",
        whodunnit: user.id,
        operation: operation_name
      )

      expect(result).to be_success

      version = Transactions::AccountVersion.last
      expect(version.item_id).to eq(account.id)
      expect(version.event).to eq("update")
      expect(version.cause).to eq("transaction_calculate_balance")
      expect(version.operation).to eq(operation_name)
      expect(version.space_id).to eq(space.id)
      expect(version.whodunnit).to eq(user.id)
    end

    it "records a create version when action is create" do
      Transactions::AccountVersion.delete_all

      result = described_class.new.call(
        cause: "account_create",
        whodunnit: user.id,
        operation: operation_name,
        action: "create",
        attributes: {
          space:,
          name: "PaperTrail Test",
          balance_cents: 0,
          balance_currency: "PHP",
          account_category: "cash"
        }
      )

      expect(result).to be_success

      created = result.value!
      version = Transactions::AccountVersion.last
      expect(version.item_id).to eq(created.id)
      expect(version.event).to eq("create")
      expect(version.cause).to eq("account_create")
    end

    it "records a discard version when action is discard" do
      account
      Transactions::AccountVersion.delete_all

      result = described_class.new.call(
        account:,
        cause: "account_discard",
        operation: operation_name,
        action: "discard"
      )

      expect(result).to be_success
      expect(account.reload).to be_discarded

      version = Transactions::AccountVersion.last
      expect(version.event).to eq("update")
      expect(version.cause).to eq("account_discard")
    end
  end
end
