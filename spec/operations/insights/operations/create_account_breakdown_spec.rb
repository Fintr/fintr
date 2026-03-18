# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'

RSpec.describe Insights::Operations::CreateAccountBreakdown do
  include Dry::Monads[:result, :do]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user], code: 'test_space') }

  let(:valid_params) do
    {
      space: space
    }
  end

  describe '#call' do
    before do
      allow(Utils::Number).to receive(:format_percentage) { |num| "#{num.round(2)}%" }
      allow(Utils::Number).to receive(:format_delimiter) { |num| "delimited_#{num}" }
    end

    context 'with valid parameters and accounts' do
      subject(:call_operation) { operation.call(valid_params) }

      let!(:account1) { create(:account, space: space, name: 'Savings Account', balance: Money.from_amount(1000, 'PHP')) }
      let!(:account2) { create(:account, space: space, name: 'Checking Account', balance: Money.from_amount(500, 'PHP')) }
      let!(:account3) { create(:account, space: space, name: 'Investment Account', balance: Money.from_amount(2000, 'PHP')) }

      it { is_expected.to be_success }

      it 'returns the correct account breakdown structure' do
        result = call_operation.value!
        expect(result).to include(:total_balance, :breakdown)
        expect(result[:total_balance]).to eq('delimited_3500.0')
        expect(result[:breakdown]).to be_an(Array)
        expect(result[:breakdown].length).to eq(3)
      end

      it 'returns balance as cents and currency_iso per account' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        expect(breakdown[0][:balance]).to eq(cents: 200_000, currency_iso: 'PHP')
        expect(breakdown[1][:balance]).to eq(cents: 100_000, currency_iso: 'PHP')
        expect(breakdown[2][:balance]).to eq(cents: 50_000, currency_iso: 'PHP')
      end

      it 'returns accounts sorted by balance in descending order' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        expect(breakdown[0][:name]).to eq('Investment Account')
        expect(breakdown[1][:name]).to eq('Savings Account')
        expect(breakdown[2][:name]).to eq('Checking Account')
      end

      it 'calculates correct percentages for each account' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        expect(breakdown[0][:percentage]).to eq('57.14%')
        expect(breakdown[1][:percentage]).to eq('28.57%')
        expect(breakdown[2][:percentage]).to eq('14.29%')
      end

      it 'includes account category for each account' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        expect(breakdown).to all(include(:name, :balance, :percentage, :category))
      end
    end

    context 'with empty accounts' do
      subject(:call_operation) { operation.call(valid_params) }

      it { is_expected.to be_success }

      it 'returns empty breakdown and zero total' do
        result = call_operation.value!
        expect(result[:total_balance]).to eq('delimited_0')
        expect(result[:breakdown]).to eq([])
      end
    end

    context 'with accounts having zero balance' do
      subject(:call_operation) { operation.call(valid_params) }

      let!(:zero_balance_account) { create(:account, space: space, name: 'Zero Account', balance: Money.from_amount(0, 'PHP')) }

      it { is_expected.to be_success }

      it 'handles zero balance accounts correctly' do
        result = call_operation.value!
        expect(result[:total_balance]).to eq('delimited_0.0')
        expect(result[:breakdown]).to be_an(Array)
        expect(result[:breakdown].length).to eq(1)
        expect(result[:breakdown][0][:balance]).to eq(cents: 0, currency_iso: 'PHP')
        expect(result[:breakdown][0][:percentage]).to eq('0%')
      end
    end

    context 'with single account' do
      subject(:call_operation) { operation.call(valid_params) }

      let!(:single_account) { create(:account, space: space, name: 'Single Account', balance: Money.from_amount(1500, 'PHP')) }

      it { is_expected.to be_success }

      it 'returns 100% for the single account' do
        result = call_operation.value!
        expect(result[:total_balance]).to eq('delimited_1500.0')
        expect(result[:breakdown].length).to eq(1)
        expect(result[:breakdown][0][:percentage]).to eq('100.0%')
      end
    end
  end

  describe 'Validation Failures' do
    context 'when space parameter is missing' do
      it 'raises ArgumentError when contract is called with no effective arguments' do
        expect { operation.call({}) }.to raise_error(ArgumentError, "wrong number of arguments (given 0, expected 1..2)")
      end
    end

    context 'when space is not a Spaces::Space object' do
      subject(:call_operation) { operation.call(space: 'not_a_space') }

      it { is_expected.to be_failure }

      it 'returns space validation error' do
        expect(call_operation.failure).to include(space: ['should be a space'])
      end
    end

    context 'when space is nil' do
      subject(:call_operation) { operation.call(space: nil) }

      it { is_expected.to be_failure }

      it 'returns space validation error' do
        expect(call_operation.failure).to include(space: ['should be a space'])
      end
    end
  end
end
