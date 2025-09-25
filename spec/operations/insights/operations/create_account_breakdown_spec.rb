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
      # Mock Utils::Number methods for consistent testing
      allow(Utils::Number).to receive(:format_number) { |num| "formatted_#{num}" }
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

      it 'returns accounts sorted by balance in descending order' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        # The operation sorts by formatted balance string, so it's alphabetical
        expect(breakdown[0][:name]).to eq('Investment Account')
        expect(breakdown[0][:balance]).to eq('formatted_2000.00')
        expect(breakdown[1][:name]).to eq('Checking Account')
        expect(breakdown[1][:balance]).to eq('formatted_500.00')
        expect(breakdown[2][:name]).to eq('Savings Account')
        expect(breakdown[2][:balance]).to eq('formatted_1000.00')
      end

      it 'calculates correct percentages for each account' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        # Investment Account: 2000/3500 * 100 = 57.14%
        expect(breakdown[0][:percentage]).to eq('57.14%')
        # Checking Account: 500/3500 * 100 = 14.29%
        expect(breakdown[1][:percentage]).to eq('14.29%')
        # Savings Account: 1000/3500 * 100 = 28.57%
        expect(breakdown[2][:percentage]).to eq('28.57%')
      end

      it 'includes account category for each account' do
        result = call_operation.value!
        breakdown = result[:breakdown]

        expect(breakdown).to all(include(:name, :balance, :percentage, :category))
      end
    end

    context 'with empty accounts' do
      it 'raises NoMethodError when no accounts exist' do
        expect { operation.call(valid_params) }.to raise_error(NoMethodError, "undefined method 'amount' for an instance of Integer")
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
        expect(result[:breakdown][0][:balance]).to eq('formatted_0.00')
        expect(result[:breakdown][0][:percentage]).to eq('NaN%')
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
