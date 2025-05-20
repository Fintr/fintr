# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'
require 'active_support/testing/time_helpers'

RSpec.describe Insights::Operations::CreateWeeklySpending do
  include Dry::Monads[:result, :do]
  include ActiveSupport::Testing::TimeHelpers

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:account) { create(:account, space: space) }

  # Helper to create transactions
  def create_transaction(type:, amount_value:, date:, currency: 'PHP')
    category_type = (type == :income) ? 'income' : 'expense'
    category_name = (type == :income) ? 'Salary' : 'Groceries' # Default, can be overridden in specific tests if needed
    category = Transactions::Category.find_or_create_by!(space: space, name: category_name, category_type: category_type)

    transaction_factory_name = "#{type}_transaction".to_sym

    create(
      transaction_factory_name,
      space: space,
      account: account,
      category: category,
      amount: Money.from_amount(amount_value, currency),
      date: date
    )
  end

  # The operation itself filters by type and date range, so we pass all transactions
  # and let the operation do its job.

  describe '#call' do
    before do
      # Make format_number mock more realistic (e.g., always show two decimal places like X.00)
      allow(Utils::Number).to receive(:format_number) do |num|
        formatted_str = format("%.2f", num) # Format to two decimal places
        "formatted_num_#{formatted_str.gsub('.', 'p')}"
      end
      allow(Utils::Number).to receive(:format_percentage) { |perc| "formatted_perc_#{perc.to_s.gsub('.', 'p')}" }
      travel_to Time.zone.local(2023, 10, 7) # A Saturday
    end

    after do
      travel_back
    end

    let(:today) { Time.zone.local(2023, 10, 7) }
    let(:monday_this_week) { today.beginning_of_week } # 2023-10-02
    let(:tuesday_this_week) { monday_this_week + 1.day } # 2023-10-03
    let(:sunday_this_week) { monday_this_week - 1.day } # 2023-10-01 (Part of the current week view starting Sat)
    # The operation range is effectively Sat, Sep 30 to Sat, Oct 7
    # So sunday_this_week (Oct 1) should be included.

    let(:two_weeks_ago) { today - 2.weeks } # Should be filtered out

    context 'with valid expense transactions within the last week' do
      subject(:call_operation) { operation.call(transactions: all_transactions) }

      let!(:expense1_mon) { create_transaction(type: :expense, amount_value: 50, date: monday_this_week) }     # 50
      let!(:expense2_mon) { create_transaction(type: :expense, amount_value: 100, date: monday_this_week) }    # 100 -> Mon total 150
      let!(:expense_tue) { create_transaction(type: :expense, amount_value: 75, date: tuesday_this_week) }      # 75  -> Tue total 75
      let!(:expense_sun) { create_transaction(type: :expense, amount_value: 30, date: sunday_this_week) } # 30 -> Sun total 30
      let!(:income_mon) { create_transaction(type: :income, amount_value: 1000, date: monday_this_week) } # Ignored
      let!(:expense_older) { create_transaction(type: :expense, amount_value: 200, date: two_weeks_ago) } # Ignored

      let(:all_transactions) { Transactions::Transaction.where(id: [expense1_mon.id, expense2_mon.id, expense_tue.id, expense_sun.id, income_mon.id, expense_older.id]) }
      # Total relevant expenses = 150 (Mon) + 75 (Tue) + 30 (Sun) = 255

      it { is_expected.to be_success }

      it 'returns correctly structured weekly spending data, sorted by day' do
        result = call_operation.value!
        expect(result.size).to eq(3) # Sunday, Monday, Tuesday

        # Sunday's data (total 30)
        sun_data = result.find { |r| r[:date] == sunday_this_week.strftime("%a") }
        expect(sun_data).to be_present
        expect(sun_data[:amount]).to eq('formatted_num_30p00')
        expect(sun_data[:percentage]).to start_with('formatted_perc_11p76') # (30/255)*100
        expect(sun_data[:currency]).to eq('PHP')

        # Monday's data (total 150)
        mon_data = result.find { |r| r[:date] == monday_this_week.strftime("%a") }
        expect(mon_data).to be_present
        expect(mon_data[:amount]).to eq('formatted_num_150p00')
        expect(mon_data[:percentage]).to start_with('formatted_perc_58p82') # (150/255)*100
        expect(mon_data[:currency]).to eq('PHP')

        # Tuesday's data (total 75)
        tue_data = result.find { |r| r[:date] == tuesday_this_week.strftime("%a") }
        expect(tue_data).to be_present
        expect(tue_data[:amount]).to eq('formatted_num_75p00')
        expect(tue_data[:percentage]).to start_with('formatted_perc_29p41') # (75/255)*100
        expect(tue_data[:currency]).to eq('PHP')

        # Check sort order (Sun, Mon, Tue) - This should now be correct with the operation change
        expect(result.map { |r| r[:date] }).to eq([
          sunday_this_week.strftime("%a"),
          monday_this_week.strftime("%a"),
          tuesday_this_week.strftime("%a")
        ])
      end
    end

    context 'when there are no expense transactions in the last week' do
      subject(:call_operation) { operation.call(transactions: all_transactions) }

      let!(:income_mon) { create_transaction(type: :income, amount_value: 1000, date: monday_this_week) }
      let!(:expense_older) { create_transaction(type: :expense, amount_value: 200, date: two_weeks_ago) }
      let(:all_transactions) { Transactions::Transaction.where(id: [income_mon.id, expense_older.id]) }

      it { is_expected.to be_success }

      it 'returns an empty array' do
        expect(call_operation.value!).to eq([])
      end
    end

    context 'when all expenses are on a single day in the last week' do
      subject(:call_operation) { operation.call(transactions: all_transactions) }

      let!(:expense1_mon) { create_transaction(type: :expense, amount_value: 50, date: monday_this_week) }
      let!(:expense2_mon) { create_transaction(type: :expense, amount_value: 100, date: monday_this_week) }
      let(:all_transactions) { Transactions::Transaction.where(id: [expense1_mon.id, expense2_mon.id]) }
      # Total 150

      it { is_expected.to be_success }

      it 'returns data for that single day with 100% percentage' do
        result = call_operation.value!
        expect(result.size).to eq(1)
        mon_data = result.first
        expect(mon_data[:date]).to eq(monday_this_week.strftime("%a"))
        expect(mon_data[:amount]).to eq('formatted_num_150p00')
        expect(mon_data[:percentage]).to eq('formatted_perc_100p0')
        expect(mon_data[:currency]).to eq('PHP')
      end
    end

    context 'when an expense transaction has zero amount' do
      subject(:call_operation) { operation.call(transactions: all_transactions) }

      let!(:expense1_mon) { create_transaction(type: :expense, amount_value: 50, date: monday_this_week) } # 50
      let!(:expense_zero_tue) { create_transaction(type: :expense, amount_value: 0, date: tuesday_this_week) }  # 0
      let(:all_transactions) { Transactions::Transaction.where(id: [expense1_mon.id, expense_zero_tue.id]) }
      # Total relevant expenses = 50

      it { is_expected.to be_success }

      it 'calculates percentages correctly, including zero amount day' do
        result = call_operation.value!
        expect(result.size).to eq(2)

        mon_data = result.find { |r| r[:date] == monday_this_week.strftime("%a") }
        expect(mon_data[:amount]).to eq('formatted_num_50p00')
        expect(mon_data[:percentage]).to eq('formatted_perc_100p0')

        tue_data = result.find { |r| r[:date] == tuesday_this_week.strftime("%a") }
        expect(tue_data[:amount]).to eq('formatted_num_0p00')
        expect(tue_data[:percentage]).to eq('formatted_perc_0p0')
      end
    end

    describe 'Contract Validations' do
      context 'when transactions parameter is missing' do
        it 'raises ArgumentError when contract is called with no effective arguments' do
          expect { operation.call({}) }.to raise_error(ArgumentError, "wrong number of arguments (given 0, expected 1..2)")
        end
      end

      context 'when transactions is an empty array' do
        subject(:call_operation) { operation.call(transactions: []) }

        it { is_expected.to be_failure }

        it 'returns transactions type error due to .first on empty array' do
          failure = call_operation.failure
          expect(failure).to include(:transactions)
          expect(failure[:transactions]).to include('should be an array of transactions')
        end
      end

      context 'when transactions is an array of non-Transaction objects' do
        subject(:call_operation) { operation.call(transactions: ['not a transaction']) }

        it { is_expected.to be_failure }

        it 'returns transactions type error' do
          expect(call_operation.failure).to include(transactions: ['should be an array of transactions'])
        end
      end
    end
  end
end
