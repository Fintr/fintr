# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::CalculateLoanPaymentInterest do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP'), name: 'Test Account') }
  let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }

  let(:loan) do
    create(
      :loan,
      user: user,
      space: space,
      entity: entity,
      account: account,
      principal_amount_cents: 100_000_00, # 100,000 PHP
      outstanding_balance_cents: 100_000_00,
      interest_rate: 10.0, # 10% annual
      loan_term_months: 12,
      date: Date.new(2024, 1, 1),
      maturity_date: Date.new(2024, 12, 31),
      loan_type: 'borrowed',
      currency: 'PHP'
    )
  end

  describe '#call' do
    context 'with invalid parameters' do
      context 'when loan is missing' do
        subject(:call_operation) { operation.call({ payment_date: Date.new(2024, 2, 1) }) }

        it { is_expected.to be_failure }

        it 'returns a failure with loan missing error' do
          expect(call_operation.failure).to have_key(:loan)
        end
      end

      context 'when payment_date is missing' do
        subject(:call_operation) { operation.call({ loan: loan }) }

        it { is_expected.to be_failure }

        it 'returns a failure with payment_date missing error' do
          expect(call_operation.failure).to have_key(:payment_date)
        end
      end

      context 'when loan is not a Loan instance' do
        subject(:call_operation) { operation.call({ loan: 'not a loan', payment_date: Date.new(2024, 2, 1) }) }

        it { is_expected.to be_failure }

        it 'returns a failure with loan type error' do
          expect(call_operation.failure).to have_key(:loan)
        end
      end
    end

    context 'with valid parameters' do
      context 'when calculating interest for the first payment' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 2, 1)
          )
        end

        it { is_expected.to be_success }

        it 'returns a Money object' do
          expect(call_operation.value!).to be_a(Money)
        end

        it 'calculates interest from loan date to payment date' do
          result = call_operation.value!
          days = (Date.new(2024, 2, 1) - loan.date).to_i
          # Formula: Principal × (Annual Rate / 365) × Days
          calculated_interest_cents = (100_000 * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end

        it 'uses the full principal amount as balance for interest calculation' do
          result = call_operation.value!
          days = 31
          calculated_interest_cents = (100_000 * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end

        it 'returns interest in the loan currency' do
          result = call_operation.value!
          expect(result.currency.to_s).to eq('PHP')
        end
      end

      context 'when calculating interest for subsequent payments' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 3, 1)
          )
        end

        let!(:first_payment) do
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(7_942.27, 'PHP'),
            interest_payment: Money.from_amount(849.32, 'PHP'),
            total_payment: Money.from_amount(8_791.59, 'PHP'),
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'calculates interest from the last payment date' do
          result = call_operation.value!
          balance_at_start = 100_000 - 7_942.27
          days = (Date.new(2024, 3, 1) - first_payment.date).to_i
          calculated_interest_cents = (balance_at_start * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end

        it 'uses the remaining balance after previous payments for interest calculation' do
          result = call_operation.value!
          balance_at_start = 100_000 - 7_942.27
          days = 29
          calculated_interest_cents = (balance_at_start * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end
      end

      context 'when multiple payments occur on the same date' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 2, 1)
          )
        end

        let!(:existing_payment) do
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(5_000, 'PHP'),
            interest_payment: Money.from_amount(800, 'PHP'),
            total_payment: Money.from_amount(5_800, 'PHP'),
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'subtracts interest already paid by other payments on the same date' do
          result = call_operation.value!
          days = 31
          total_interest_cents = (100_000 * (0.10 / 365.0) * days * 100).round
          total_interest = total_interest_cents / 100.0
          expected_interest = total_interest - existing_payment.interest_payment.amount
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end
      end

      context 'when updating an existing payment with exclude_payment_id' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 2, 1),
            exclude_payment_id: existing_payment.id.to_s
          )
        end

        let!(:existing_payment) do
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(5_000, 'PHP'),
            interest_payment: Money.from_amount(800, 'PHP'),
            total_payment: Money.from_amount(5_800, 'PHP'),
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'excludes the specified payment from both previous payments and interest already paid calculations' do
          # The operation should not consider the excluded payment when:
          # 1. Finding last payment (should use loan date if excluded payment is the only one)
          # 2. Calculating interest already paid (should not subtract excluded payment's interest)
          result = call_operation.value!
          days = 31
          calculated_interest_cents = (100_000 * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end
      end

      context 'when all interest for the period has been paid' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 2, 1)
          )
        end

        let!(:existing_payment) do
          days = 31
          total_interest = (100_000 * (0.10 / 365.0) * days).round(2)
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(5_000, 'PHP'),
            interest_payment: Money.from_amount(total_interest, 'PHP'),
            total_payment: Money.from_amount(5_000 + total_interest, 'PHP'),
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'returns zero interest' do
          result = call_operation.value!
          expect(result.amount).to be_within(0.1).of(0.0)
        end
      end

      context 'when more interest has been paid than calculated' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 2, 1)
          )
        end

        let!(:existing_payment) do
          days = 31
          total_interest = (100_000 * (0.10 / 365.0) * days).round(2)
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(5_000, 'PHP'),
            interest_payment: Money.from_amount(total_interest + 100, 'PHP'),
            total_payment: Money.from_amount(5_000 + total_interest + 100, 'PHP'),
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'returns zero interest (does not return negative)' do
          result = call_operation.value!
          expect(result.amount).to eq(0.0)
        end
      end

      context 'with zero interest rate' do
        subject(:call_operation) do
          operation.call(
            loan: zero_interest_loan,
            payment_date: Date.new(2024, 2, 1)
          )
        end

        let(:zero_interest_loan) do
          create(
            :loan,
            user: user,
            space: space,
            entity: entity,
            account: account,
            principal_amount_cents: 100_000_00,
            outstanding_balance_cents: 100_000_00,
            interest_rate: 0.0,
            loan_term_months: 12,
            date: Date.new(2024, 1, 1),
            maturity_date: Date.new(2024, 12, 31),
            loan_type: 'borrowed',
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'returns zero interest' do
          result = call_operation.value!
          expect(result.amount).to eq(0.0)
        end
      end

      context 'with different payment dates' do
        subject(:call_operation) { operation.call(loan: loan, payment_date: payment_date) }

        context 'when payment is late' do
          let(:payment_date) { Date.new(2024, 2, 15) } # 15 days late

          it { is_expected.to be_success }

          it 'calculates interest for the actual days (45 days total)' do
            result = call_operation.value!
            days = (payment_date - loan.date).to_i
            calculated_interest_cents = (100_000 * (0.10 / 365.0) * days * 100).round
            expected_interest = calculated_interest_cents / 100.0
            expect(result.amount).to be_within(0.5).of(expected_interest)
          end
        end

        context 'when payment is early' do
          let(:payment_date) { Date.new(2024, 1, 20) } # 19 days (early)

          it { is_expected.to be_success }

          it 'calculates interest for fewer days' do
            result = call_operation.value!
            days = (payment_date - loan.date).to_i
            calculated_interest_cents = (100_000 * (0.10 / 365.0) * days * 100).round
            expected_interest = calculated_interest_cents / 100.0
            expect(result.amount).to be_within(0.5).of(expected_interest)
          end
        end
      end

      context 'with multiple previous payments' do
        subject(:call_operation) do
          operation.call(
            loan: loan,
            payment_date: Date.new(2024, 4, 1)
          )
        end

        let!(:first_payment) do
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(7_942.27, 'PHP'),
            interest_payment: Money.from_amount(849.32, 'PHP'),
            total_payment: Money.from_amount(8_791.59, 'PHP'),
            currency: 'PHP'
          )
        end

        let!(:second_payment) do
          create(
            :loan_payment,
            loan: loan,
            account: account,
            date: Date.new(2024, 3, 1),
            principal_payment: Money.from_amount(8_008.35, 'PHP'),
            interest_payment: Money.from_amount(783.24, 'PHP'),
            total_payment: Money.from_amount(8_791.59, 'PHP'),
            currency: 'PHP'
          )
        end

        it { is_expected.to be_success }

        it 'uses the balance after all previous principal payments' do
          result = call_operation.value!
          total_principal_paid = first_payment.principal_payment.amount + second_payment.principal_payment.amount
          balance_at_start = 100_000 - total_principal_paid
          days = (Date.new(2024, 4, 1) - second_payment.date).to_i
          calculated_interest_cents = (balance_at_start * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end

        it 'calculates interest from the most recent payment date' do
          result = call_operation.value!
          days = (Date.new(2024, 4, 1) - Date.new(2024, 3, 1)).to_i
          expect(days).to eq(31)
          # Verify it's using second_payment date, not first_payment date
          total_principal_paid = first_payment.principal_payment.amount + second_payment.principal_payment.amount
          balance_at_start = 100_000 - total_principal_paid
          calculated_interest_cents = (balance_at_start * (0.10 / 365.0) * days * 100).round
          expected_interest = calculated_interest_cents / 100.0
          expect(result.amount).to be_within(0.5).of(expected_interest)
        end
      end
    end
  end
end
