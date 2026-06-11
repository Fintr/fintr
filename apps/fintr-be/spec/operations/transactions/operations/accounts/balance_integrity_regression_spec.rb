# frozen_string_literal: true

require 'rails_helper'

# Regression probes for Joan Perez / BDO Payables ghost balance investigation.
RSpec.describe 'Account balance integrity regressions' do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }

  before do
    Transactions::Category.create_default_categories(space)
  end

  describe 'CreateAccount find_or_initialize_by with pre-existing balance' do
    it 'clears orphan balance when reopening an account with balance 0 skips initial tx' do
      existing = Transactions::Account.create!(
        space: space,
        name: 'CC Payable - Papa Metrobank',
        account_category: 'credit_card',
        balance: Money.from_amount(5652, 'PHP'),
        balance_currency: 'PHP'
      )

      result = Transactions::Operations::Accounts::CreateAccount.new.call(
        user_id: user.id,
        space_id: space.id,
        name: 'CC Payable - Papa Metrobank',
        balance: 0.to_d,
        account_category: 'credit_card'
      )

      expect(result).to be_success
      existing.reload
      expect(existing.transactions.count).to eq(0)
      expect(existing.balance.amount).to eq(0.0)
    end
  end

  describe 'adjust_balance then delete adjustment transaction' do
    let!(:account) do
      create(
        :account,
        space: space,
        name: 'BDO Payables - Cash Reserve',
        balance: Money.from_amount(353.19, 'PHP')
      )
    end

    let!(:initial_category) do
      Transactions::Category.find_or_create_by!(
        space: space,
        name: 'Initial Balance',
        category_type: 'income'
      )
    end

    let!(:initial_tx) do
      create(
        :income_transaction,
        user: user,
        space: space,
        account: account,
        category: initial_category,
        amount: Money.from_amount(353.19, 'PHP'),
        balance_state: 'calculated',
        date: Date.new(2026, 5, 12)
      )
    end

    it 'reverts account balance when the Income Adjustment is deleted' do
      adjustment = Transactions::Operations::Accounts::AdjustAccountBalance.new.call(
        user_id: user.id,
        space_id: space.id,
        id: account.id,
        new_balance: 36_353.19,
        adjustment_date: '2026-05-21'
      )
      expect(adjustment).to be_success
      expect(account.reload.balance.amount).to eq(36_353.19)

      delete_result = Transactions::Operations::DeleteTransaction.new.call(
        id: adjustment.value!.id
      )
      expect(delete_result).to be_success

      expect(account.reload.balance.amount).to eq(353.19)
      expect(account.transactions.count).to eq(1)
      expect(account.transactions.first.id).to eq(initial_tx.id)
    end

    it 'reverts account balance when the Income Adjustment is deleted via the API' do
      adjustment = Transactions::Operations::Accounts::AdjustAccountBalance.new.call(
        user_id: user.id,
        space_id: space.id,
        id: account.id,
        new_balance: 36_353.19,
        adjustment_date: '2026-05-21'
      )
      expect(adjustment).to be_success

      delete_result = Transactions::Operations::DeleteTransaction.new.call(
        id: adjustment.value!.id
      )
      expect(delete_result).to be_success

      expect(account.reload.balance.amount).to eq(353.19)
      expect(account.transactions.count).to eq(1)
    end
  end

  describe 'account edit creating then losing an adjustment transaction' do
    let!(:account) do
      create(
        :account,
        space: space,
        name: 'BDO Payables - Cash Reserve',
        balance: Money.from_amount(353.19, 'PHP')
      )
    end

    let!(:initial_tx) do
      create(
        :income_transaction,
        user: user,
        space: space,
        account: account,
        category: Transactions::Category.find_or_create_by!(
          space: space,
          name: 'Initial Balance',
          category_type: 'income'
        ),
        amount: Money.from_amount(353.19, 'PHP'),
        balance_state: 'calculated',
        date: Date.new(2026, 5, 12)
      )
    end

    it 'matches Joan ghost balance when a +36000 adjustment is removed without reverting' do
      adjustment = Transactions::Operations::Accounts::AdjustAccountBalance.new.call(
        user_id: user.id,
        space_id: space.id,
        id: account.id,
        new_balance: 36_353.19,
        adjustment_date: '2026-05-21'
      )
      expect(adjustment).to be_success
      expect(account.reload.balance.amount).to eq(36_353.19)
      expect(account.transactions.count).to eq(2)

      # Simulates update_this_and_future delete_all on a mis-tagged row (no balance revert).
      Transactions::Transaction.find(adjustment.value!.id).delete

      expect(account.reload.balance.amount).to eq(36_353.19)
      expect(account.transactions.count).to eq(1)
      expect(account.transactions.first.id).to eq(initial_tx.id)
    end
  end

  describe 'moving a calculated expense between accounts via UpdateTransaction' do
    let!(:bdo) do
      create(
        :account,
        space: space,
        name: 'BDO Payables - Cash Reserve',
        balance: Money.from_amount(353.19, 'PHP')
      )
    end

    let!(:jerick) do
      create(
        :account,
        space: space,
        name: 'CC Payable - Jerick Card',
        account_category: 'credit_card',
        balance: Money.from_amount(0, 'PHP')
      )
    end

    let!(:expense) do
      result = Transactions::Operations::CreateTransaction.new.call(
        user_id: user.id,
        space_id: space.id,
        amount: 6060,
        date: Date.new(2026, 5, 9),
        transaction_type: 'expense',
        category_name: space.expense_categories.first.name,
        account_name: bdo.name,
        schedule_type: 'one_time'
      )
      result.value!
    end

    before do
      bdo.reload
      jerick.reload
    end

    it 'keeps BDO at 353.19 after moving the expense to Jerick' do
      expect(bdo.balance.amount).to eq(353.19 - 6060)

      update_result = Transactions::Operations::UpdateTransaction.new.call(
        id: expense.id,
        user_id: user.id,
        space_id: space.id,
        amount: 6060,
        date: Date.new(2026, 5, 9),
        transaction_type: 'expense',
        category_name: expense.category.name,
        account_name: jerick.name,
        description: '',
        schedule_type: 'one_time'
      )

      expect(update_result).to be_success
      expect(bdo.reload.balance.amount).to eq(353.19)
      expect(jerick.reload.balance.amount).to eq(-6060.0)
    end
  end

  describe 'moving a pending expense between accounts via UpdateTransaction' do
    let!(:bdo) do
      create(
        :account,
        space: space,
        name: 'BDO Payables - Cash Reserve',
        balance: Money.from_amount(353.19, 'PHP')
      )
    end

    let!(:jerick) do
      create(
        :account,
        space: space,
        name: 'CC Payable - Jerick Card',
        account_category: 'credit_card',
        balance: Money.from_amount(0, 'PHP')
      )
    end

    let!(:expense) do
      create(
        :expense_transaction,
        user: user,
        space: space,
        account: bdo,
        category: space.expense_categories.first,
        amount: Money.from_amount(6060, 'PHP'),
        balance_state: 'pending',
        date: Date.new(2026, 5, 9)
      )
    end

    it 'does not corrupt BDO when account changes and balance becomes calculated' do
      update_result = Transactions::Operations::UpdateTransaction.new.call(
        id: expense.id,
        user_id: user.id,
        space_id: space.id,
        amount: 6060,
        date: Date.new(2026, 5, 9),
        transaction_type: 'expense',
        category_name: expense.category.name,
        account_name: jerick.name,
        description: '',
        schedule_type: 'one_time'
      )

      expect(update_result).to be_success
      expect(bdo.reload.balance.amount).to eq(353.19)
      expect(jerick.reload.balance.amount).to eq(-6060.0)
    end
  end
end
