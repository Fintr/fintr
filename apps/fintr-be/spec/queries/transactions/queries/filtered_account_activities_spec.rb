# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Queries::FilteredAccountActivities do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let!(:account) do
    create(
      :account,
      space: space,
      name: "BDO Payables - Cash Reserve",
      balance: Money.from_amount(353.19, "PHP")
    )
  end

  let!(:entity) do
    Entities::Entity.find_or_create_by!(
      space: space,
      entity_type: "loan",
      full_name: "Cebu Pacific"
    )
  end

  let!(:initial_category) do
    Transactions::Category.find_or_create_by!(
      space: space,
      name: "Initial Balance",
      category_type: "income"
    )
  end

  let!(:initial_tx) do
    create(
      :income_transaction,
      user: user,
      space: space,
      account: account,
      category: initial_category,
      amount: Money.from_amount(353.19, "PHP"),
      balance_state: "calculated",
      date: Date.new(2026, 5, 12)
    )
  end

  let!(:loan) do
    Transactions::Loan.create!(
      user: user,
      space: space,
      entity: entity,
      account: account,
      principal_amount_cents: 36_000_00,
      outstanding_balance_cents: 36_000_00,
      currency: "PHP",
      interest_rate: 0,
      date: Date.new(2026, 5, 4),
      loan_type: "borrowed",
      loan_term_months: 12,
      maturity_date: Date.new(2027, 5, 4),
      status: "active",
      adjusts_account_balance: true
    )
  end

  let(:default_params) do
    {
      account_id: account.id,
      space_id: space.id,
      start_date: Date.new(2026, 1, 1),
      end_date: Date.new(2026, 12, 31),
      page: 1,
      per_page: 25
    }
  end

  describe ".call" do
    it "returns initial balance and loan disbursement activities for the account" do
      result = described_class.call(params: default_params)

      expect(result).to be_success

      activities = result.value!
      kinds = activities.map(&:activity_kind)

      expect(kinds).to include("income", "loan_disbursement")
      expect(activities.map(&:account_id).uniq).to eq([account.id])
    end

    it "orders by date desc then created_at desc" do
      result = described_class.call(params: default_params)
      activities = result.value!.to_a

      expect(activities.first.date).to be >= activities.last.date
    end

    it "fails when account is not in space" do
      other_space = create(:personal_space)
      result = described_class.call(
        params: default_params.merge(
          account_id: account.id,
          space_id: other_space.id
        )
      )

      expect(result).to be_failure
      expect(result.failure).to eq(account_id: "not found")
    end

    it "excludes loan disbursements that do not adjust account balance" do
      Transactions::Loan.create!(
        user: user,
        space: space,
        entity: entity,
        account: account,
        principal_amount_cents: 10_000_00,
        outstanding_balance_cents: 10_000_00,
        currency: "PHP",
        interest_rate: 0,
        date: Date.new(2026, 5, 5),
        loan_type: "borrowed",
        loan_term_months: 12,
        maturity_date: Date.new(2027, 5, 5),
        status: "active",
        adjusts_account_balance: false
      )

      result = described_class.call(params: default_params)
      activities = result.value!

      loan_disbursements = activities.select { |a| a.activity_kind == "loan_disbursement" }

      expect(loan_disbursements.map(&:activitable_id)).to eq([loan.id])
    end

    it "excludes loan payments that do not adjust account balance" do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2026, 6, 1),
        principal_payment_cents: 3_000_00,
        interest_payment_cents: 0,
        total_payment_cents: 3_000_00,
        currency: "PHP",
        adjusts_account_balance: false
      )

      balance_adjusting_payment = create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2026, 6, 15),
        principal_payment_cents: 1_000_00,
        interest_payment_cents: 0,
        total_payment_cents: 1_000_00,
        currency: "PHP",
        adjusts_account_balance: true
      )

      result = described_class.call(params: default_params)
      activities = result.value!
      loan_payments = activities.select { |a| a.activity_kind == "loan_payment" }

      expect(loan_payments.map(&:activitable_id)).to eq([balance_adjusting_payment.id])
    end

    context 'with category filtering' do
      let!(:food_category) do
        create(:category, space: space, name: 'Food', category_type: 'expense')
      end
      let!(:food_expense) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          category: food_category,
          amount: Money.from_amount(100, 'PHP'),
          balance_state: 'calculated',
          date: Date.new(2026, 5, 20)
        )
      end
      let!(:transfer) do
        other_account = create(:account, space: space, name: 'Savings')
        create(
          :transfer,
          space: space,
          from_account: account,
          to_account: other_account,
          date: Date.new(2026, 5, 25),
          amount_cents: 50_00
        )
      end

      it 'returns only income and expense activities for category_id filter' do
        result = described_class.call(
          params: default_params.merge(
            category_id: food_category.id,
            category_name: nil
          )
        )

        expect(result).to be_success
        expect(result.value!.map(&:activitable)).to contain_exactly(food_expense)
      end

      it 'returns all activity kinds when no category filters are provided' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        expect(result.value!.map(&:activity_kind)).to include(
          'income',
          'loan_disbursement',
        )
        expect(result.value!.map(&:activitable)).to include(
          food_expense,
          transfer,
        )
      end

      it 'returns all activity kinds when category_filters is empty' do
        result = described_class.call(
          params: default_params.merge(category_filters: []),
        )

        expect(result).to be_success
        expect(result.value!.map(&:activitable)).to include(
          food_expense,
          transfer,
        )
      end
    end
  end
end
