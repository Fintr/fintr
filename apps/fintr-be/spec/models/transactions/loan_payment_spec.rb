# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::LoanPayment, type: :model do
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
      principal_amount_cents: 100_000_00,
      outstanding_balance_cents: 100_000_00,
      interest_rate: 10.0,
      loan_term_months: 12,
      date: Date.new(2024, 1, 1),
      maturity_date: Date.new(2024, 12, 31),
      loan_type: 'borrowed',
      currency: 'PHP'
    )
  end

  describe 'associations' do
    it { is_expected.to belong_to(:loan).class_name('Transactions::Loan') }
    it { is_expected.to belong_to(:account).class_name('Transactions::Account') }
    it { is_expected.to belong_to(:transaction_record).class_name('Transactions::Transaction').optional }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:date) }
    it { is_expected.to validate_presence_of(:principal_payment_cents) }
    it { is_expected.to validate_presence_of(:interest_payment_cents) }
    it { is_expected.to validate_presence_of(:total_payment_cents) }
    it { is_expected.to validate_presence_of(:account) }

    it { is_expected.to validate_numericality_of(:principal_payment_cents).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:interest_payment_cents).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:total_payment_cents).is_greater_than(0) }

    context 'when principal_payment_cents is negative' do
      let(:loan_payment) { build(:loan_payment, loan: loan, account: account, principal_payment_cents: -100) }

      it 'is invalid' do
        expect(loan_payment).not_to be_valid
        expect(loan_payment.errors[:principal_payment_cents]).to include('must be greater than or equal to 0')
      end
    end

    context 'when interest_payment_cents is negative' do
      let(:loan_payment) { build(:loan_payment, loan: loan, account: account, interest_payment_cents: -100) }

      it 'is invalid' do
        expect(loan_payment).not_to be_valid
        expect(loan_payment.errors[:interest_payment_cents]).to include('must be greater than or equal to 0')
      end
    end

    context 'when total_payment_cents is zero' do
      let(:loan_payment) { build(:loan_payment, loan: loan, account: account, total_payment_cents: 0) }

      it 'is invalid' do
        expect(loan_payment).not_to be_valid
        expect(loan_payment.errors[:total_payment_cents]).to include('must be greater than 0')
      end
    end

    context 'when total_payment_cents is negative' do
      let(:loan_payment) { build(:loan_payment, loan: loan, account: account, total_payment_cents: -100) }

      it 'is invalid' do
        expect(loan_payment).not_to be_valid
        expect(loan_payment.errors[:total_payment_cents]).to include('must be greater than 0')
      end
    end

    context 'when account is missing' do
      let(:loan_payment) { build(:loan_payment, loan: loan, account: nil) }

      it 'is invalid' do
        expect(loan_payment).not_to be_valid
        expect(loan_payment.errors[:account]).to include("can't be blank")
      end
    end
  end

  describe 'monetization' do
    it { is_expected.to monetize(:principal_payment_cents).with_model_currency(:currency) }
    it { is_expected.to monetize(:interest_payment_cents).with_model_currency(:currency) }
    it { is_expected.to monetize(:total_payment_cents).with_model_currency(:currency) }
  end

  describe '#calculate_interest_for_payment' do
    context 'when this is the first payment' do
      let(:loan_payment) do
        build(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1)
        )
      end

      it 'calculates interest from loan date to payment date' do
        expected_interest = loan.calculate_interest_for_period(loan.date, loan_payment.date)
        expect(loan_payment.calculate_interest_for_payment).to eq(expected_interest)
      end

      it 'uses the full principal amount for interest calculation' do
        interest = loan_payment.calculate_interest_for_payment
        expected_interest = loan.calculate_interest_for_period(loan.date, loan_payment.date)
        expect(interest.cents).to be_within(1).of(expected_interest.cents)
      end
    end

    context 'when there are previous payments' do
      let!(:first_payment) do
        create(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          principal_payment_cents: 7_942_27,
          interest_payment_cents: 849_32,
          total_payment_cents: 8_791_59,
          currency: 'PHP'
        )
      end

      let(:second_payment) do
        build(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 3, 1)
        )
      end

      it 'calculates interest from the last payment date' do
        expected_interest = loan.calculate_interest_for_period(first_payment.date, second_payment.date)
        expect(second_payment.calculate_interest_for_payment).to eq(expected_interest)
      end

      it 'uses the reduced balance after previous payments' do
        interest = second_payment.calculate_interest_for_payment
        expected_interest = loan.calculate_interest_for_period(first_payment.date, second_payment.date)
        expect(interest.cents).to be_within(1).of(expected_interest.cents)
      end
    end
  end

  describe '#auto_calculate_components!' do
    let(:loan_payment) do
      build(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        principal_payment_cents: 0,
        interest_payment_cents: 0,
        currency: 'PHP'
      )
    end

    context 'when total payment covers interest and principal' do
      it 'calculates interest correctly' do
        loan_payment.auto_calculate_components!
        calculated_interest = loan_payment.calculate_interest_for_payment
        expect(loan_payment.interest_payment).to eq(calculated_interest)
      end

      it 'calculates principal as total payment minus interest' do
        loan_payment.auto_calculate_components!
        expected_principal = loan_payment.total_payment - loan_payment.interest_payment
        expect(loan_payment.principal_payment.cents).to be_within(1).of(expected_principal.cents)
      end

      it 'saves the loan payment' do
        expect { loan_payment.auto_calculate_components! }.to change(loan_payment, :persisted?).from(false).to(true)
      end
    end

    context 'when total payment only covers partial interest' do
      let(:small_payment) do
        build(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          total_payment_cents: 500_00,
          principal_payment_cents: 0,
          interest_payment_cents: 0,
          currency: 'PHP'
        )
      end

      it 'sets interest payment to total payment' do
        small_payment.auto_calculate_components!
        expect(small_payment.interest_payment).to eq(small_payment.total_payment)
      end

      it 'sets principal payment to zero' do
        small_payment.auto_calculate_components!
        expect(small_payment.principal_payment_cents).to eq(0)
      end
    end

    context 'when principal and interest are already set' do
      let(:loan_payment_with_components) do
        build(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          total_payment_cents: 8_791_59,
          principal_payment_cents: 7_942_27,
          interest_payment_cents: 849_32,
          currency: 'PHP'
        )
      end

      it 'recalculates and overwrites the existing values' do
        original_principal = loan_payment_with_components.principal_payment_cents
        loan_payment_with_components.auto_calculate_components!
        expect(loan_payment_with_components.principal_payment_cents).not_to eq(original_principal)
      end
    end
  end

  describe '#process_payment' do
    let(:loan_payment) do
      build(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        principal_payment_cents: 0,
        interest_payment_cents: 0,
        currency: 'PHP'
      )
    end

    context 'when principal and interest are zero' do
      it 'calls auto_calculate_components!' do
        expect(loan_payment).to receive(:auto_calculate_components!)
        loan_payment.process_payment
      end
    end

    context 'when principal and interest are already set' do
      let(:loan_payment_with_components) do
        build(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          total_payment_cents: 8_791_59,
          principal_payment_cents: 7_942_27,
          interest_payment_cents: 849_32,
          currency: 'PHP'
        )
      end

      it 'does not call auto_calculate_components!' do
        expect(loan_payment_with_components).not_to receive(:auto_calculate_components!)
        loan_payment_with_components.process_payment
      end
    end

    it 'recalculates the loan outstanding balance' do
      expect(loan).to receive(:recalculate_outstanding_balance!)
      loan_payment.process_payment
    end
  end

  describe '#reprocess_payment' do
    let(:loan_payment) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    it 'recalculates the loan outstanding balance' do
      expect(loan).to receive(:recalculate_outstanding_balance!)
      loan_payment.reprocess_payment
    end
  end

  describe '#recalculate_loan' do
    let(:loan_payment) do
      create(
        :loan_payment,
        loan: loan,
        account: account,
        date: Date.new(2024, 2, 1),
        total_payment_cents: 8_791_59,
        currency: 'PHP'
      )
    end

    it 'recalculates the loan outstanding balance' do
      expect(loan).to receive(:recalculate_outstanding_balance!)
      loan_payment.recalculate_loan
    end
  end

  describe 'callbacks' do
    describe 'after_update :reprocess_payment' do
      let(:loan_payment) do
        create(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          total_payment_cents: 8_791_59,
          currency: 'PHP'
        )
      end

      it 'calls reprocess_payment when payment is updated' do
        expect(loan_payment).to receive(:reprocess_payment)
        loan_payment.update!(total_payment_cents: 10_000_00)
      end
    end

    describe 'after_destroy :recalculate_loan' do
      let(:loan_payment) do
        create(
          :loan_payment,
          loan: loan,
          account: account,
          date: Date.new(2024, 2, 1),
          total_payment_cents: 8_791_59,
          currency: 'PHP'
        )
      end

      it 'calls recalculate_loan when payment is destroyed' do
        expect(loan_payment).to receive(:recalculate_loan)
        loan_payment.destroy
      end
    end
  end
end
