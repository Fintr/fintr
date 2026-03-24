# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Loan, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to belong_to(:entity).class_name("Entities::Entity") }
    it { is_expected.to belong_to(:account).class_name("Transactions::Account") }
    it { is_expected.to have_many(:loan_payments).dependent(:destroy) }
    it { is_expected.to have_one(:rag_embedding).class_name("Ai::RagEmbedding") }
  end

  describe 'validations' do
    subject(:loan) { build(:loan) }

    it { is_expected.to validate_presence_of(:interest_rate) }
    it { is_expected.to validate_presence_of(:principal_amount_cents) }
    it { is_expected.to validate_presence_of(:outstanding_balance_cents) }
    it { is_expected.to validate_presence_of(:loan_term_months) }
    it { is_expected.to validate_presence_of(:date) }
    it { is_expected.to validate_presence_of(:maturity_date) }

    it { is_expected.to validate_numericality_of(:interest_rate).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:principal_amount_cents).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:loan_term_months).is_greater_than(0) }

    context 'when interest_rate is negative' do
      it 'is invalid' do
        loan = build(:loan, interest_rate: -1.0)
        expect(loan).not_to be_valid
        expect(loan.errors[:interest_rate]).to include('must be greater than or equal to 0')
      end
    end

    context 'when interest_rate is 100 or greater' do
      it 'is invalid' do
        loan = build(:loan, interest_rate: 100.0)
        expect(loan).not_to be_valid
        expect(loan.errors[:interest_rate]).to be_present
      end
    end

    context 'when principal_amount_cents is zero or negative' do
      it 'is invalid' do
        loan = build(:loan, principal_amount_cents: 0)
        expect(loan).not_to be_valid
        expect(loan.errors[:principal_amount_cents]).to include('must be greater than 0')
      end
    end

    context 'when loan_term_months is zero or negative' do
      it 'is invalid' do
        loan = build(:loan, loan_term_months: 0)
        expect(loan).not_to be_valid
        expect(loan.errors[:loan_term_months]).to include('must be greater than 0')
      end
    end
  end

  describe 'enums' do
    describe 'loan_type enum' do
      it 'defines the correct enum values' do
        expect(described_class.loan_types.keys).to match_array(%w[borrowed lent])
        expect(described_class.loan_types.values).to match_array(%w[borrowed lent])
      end

      it 'provides enum query methods' do
        borrowed_loan = build(:loan, loan_type: :borrowed)
        lent_loan = build(:loan, loan_type: :lent)

        expect(borrowed_loan.borrowed?).to be true
        expect(borrowed_loan.lent?).to be false
        expect(lent_loan.lent?).to be true
        expect(lent_loan.borrowed?).to be false
      end
    end

    describe 'status enum' do
      it 'defines the correct enum values' do
        expect(described_class.statuses.keys).to match_array(%w[active paid_off defaulted])
        expect(described_class.statuses.values).to match_array(%w[active paid_off defaulted])
      end

      it 'provides enum query methods' do
        active_loan = build(:loan, status: :active)
        paid_off_loan = build(:loan, status: :paid_off)
        defaulted_loan = build(:loan, status: :defaulted)

        expect(active_loan.active?).to be true
        expect(active_loan.paid_off?).to be false
        expect(paid_off_loan.paid_off?).to be true
        expect(paid_off_loan.active?).to be false
        expect(defaulted_loan.defaulted?).to be true
        expect(defaulted_loan.active?).to be false
      end
    end
  end

  describe 'callbacks' do
    describe 'set_default_currency' do
      it 'sets default currency to PHP if not provided' do
        loan = build(:loan, currency: nil)
        loan.valid?
        expect(loan.currency).to eq("PHP")
      end

      it 'does not override existing currency' do
        loan = build(:loan, currency: "USD")
        loan.valid?
        expect(loan.currency).to eq("USD")
      end
    end
  end

  describe '#calculate_interest_for_period' do
    let(:loan) do
      create(
        :loan,
        principal_amount_cents: 100_000_00,
        outstanding_balance_cents: 100_000_00,
        interest_rate: 10.0,
        date: Date.new(2024, 1, 1)
      )
    end

    it 'calculates interest using daily simple interest formula' do
      start_date = Date.new(2024, 1, 1)
      end_date = Date.new(2024, 1, 31)
      days = (end_date - start_date).to_i

      # Formula: (Annual Rate / 365) × Balance × Days (industry standard)
      expected_interest = Money.from_amount(100_000.00, "PHP") * (10.0 / 100.0 / 365.0) * days

      interest = loan.calculate_interest_for_period(start_date, end_date)
      expect(interest).to eq(expected_interest)
    end

    it 'uses provided balance instead of outstanding_balance when given' do
      start_date = Date.new(2024, 1, 1)
      end_date = Date.new(2024, 1, 31)
      custom_balance = Money.from_amount(50_000.00, "PHP")

      interest = loan.calculate_interest_for_period(start_date, end_date, custom_balance)
      days = (end_date - start_date).to_i
      expected_interest = custom_balance * (10.0 / 100.0 / 365.0) * days

      expect(interest).to eq(expected_interest)
    end

    it 'uses outstanding_balance when balance is not provided' do
      start_date = Date.new(2024, 1, 1)
      end_date = Date.new(2024, 1, 31)

      interest = loan.calculate_interest_for_period(start_date, end_date)
      days = (end_date - start_date).to_i
      expected_interest = loan.outstanding_balance * (10.0 / 100.0 / 365.0) * days

      expect(interest).to eq(expected_interest)
    end
  end

  describe '#recalculate_outstanding_balance!' do
    let(:loan) do
      create(
        :loan,
        principal_amount_cents: 100_000_00,
        outstanding_balance_cents: 100_000_00,
        status: :active
      )
    end

    it 'updates outstanding_balance based on principal payments' do
      create(
        :loan_payment,
        loan: loan,
        principal_payment_cents: 10_000_00
      )

      loan.recalculate_outstanding_balance!
      expect(loan.outstanding_balance_cents).to eq(90_000_00)
    end

    it 'sets status to paid_off when balance reaches zero' do
      create(
        :loan_payment,
        loan: loan,
        principal_payment_cents: 100_000_00
      )

      loan.recalculate_outstanding_balance!
      expect(loan.outstanding_balance_cents).to eq(0)
      expect(loan.status).to eq("paid_off")
      expect(loan.paid_off_date).to eq(Date.current)
    end

    it 'sets status to active when balance becomes positive again after being paid off' do
      loan.update!(status: :paid_off, paid_off_date: Date.current, outstanding_balance_cents: 0)

      # Simulate reversing a payment
      loan.update!(outstanding_balance_cents: 10_000_00)
      loan.recalculate_outstanding_balance!

      expect(loan.status).to eq("active")
      expect(loan.paid_off_date).to be_nil
    end

    it 'handles multiple payments correctly' do
      create(:loan_payment, loan: loan, principal_payment_cents: 20_000_00)
      create(:loan_payment, loan: loan, principal_payment_cents: 30_000_00)

      loan.recalculate_outstanding_balance!
      expect(loan.outstanding_balance_cents).to eq(50_000_00)
    end
  end

  describe '#value' do
    context 'when loan_type is borrowed' do
      let(:loan) do
        create(
          :loan,
          loan_type: :borrowed,
          outstanding_balance_cents: 100_000_00
        )
      end

      it 'returns negative outstanding_balance as liability' do
        expect(loan.value).to eq(Money.from_amount(-100_000.00, "PHP"))
      end
    end

    context 'when loan_type is lent' do
      let(:loan) do
        create(
          :loan,
          loan_type: :lent,
          outstanding_balance_cents: 100_000_00
        )
      end

      it 'returns positive outstanding_balance as asset' do
        expect(loan.value).to eq(Money.from_amount(100_000.00, "PHP"))
      end
    end
  end

  describe '#income' do
    context 'when loan_type is borrowed' do
      let(:loan) do
        create(
          :loan,
          loan_type: :borrowed,
          interest_rate: 10.0,
          date: Date.new(2024, 1, 1)
        )
      end

      it 'returns zero' do
        expect(loan.income).to eq(Money.from_amount(0, "PHP"))
      end
    end

    context 'when loan_type is lent' do
      let(:loan) do
        create(
          :loan,
          loan_type: :lent,
          principal_amount_cents: 100_000_00,
          outstanding_balance_cents: 100_000_00,
          interest_rate: 10.0,
          date: Date.new(2024, 1, 1)
        )
      end

      it 'returns calculated interest for the period' do
        expected_interest = loan.calculate_interest_for_period(loan.date, Date.current)
        expect(loan.income).to eq(expected_interest)
      end
    end
  end

  describe '#expense' do
    context 'when loan_type is borrowed' do
      let(:loan) do
        create(
          :loan,
          loan_type: :borrowed,
          principal_amount_cents: 100_000_00,
          outstanding_balance_cents: 100_000_00,
          interest_rate: 10.0,
          date: Date.new(2024, 1, 1)
        )
      end

      it 'returns calculated interest for the period' do
        expected_interest = loan.calculate_interest_for_period(loan.date, Date.current)
        expect(loan.expense).to eq(expected_interest)
      end
    end

    context 'when loan_type is lent' do
      let(:loan) do
        create(
          :loan,
          loan_type: :lent,
          interest_rate: 10.0
        )
      end

      it 'returns zero' do
        expect(loan.expense).to eq(Money.from_amount(0, "PHP"))
      end
    end
  end

  describe '#total_value' do
    let(:loan) do
      create(
        :loan,
        principal_amount_cents: 9_400_000_00,
        outstanding_balance_cents: 9_400_000_00,
        interest_rate: 8.0,
        loan_term_months: 240,
        date: Date.new(2024, 1, 1),
        maturity_date: Date.new(2044, 1, 1),
        currency: "PHP"
      )
    end

    it 'calculates total value as sum of all scheduled payments (principal + interest)' do
      schedule = loan.generate_amortization_schedule
      expected_total = schedule.sum { |entry| entry[:payment_amount] }
      
      expect(loan.total_value.amount).to be_within(0.01).of(expected_total)
    end

    it 'verifies total value equals principal plus total interest' do
      schedule = loan.generate_amortization_schedule
      total_principal = schedule.sum { |entry| entry[:principal_payment] }
      total_interest = schedule.sum { |entry| entry[:interest_payment] }
      
      expect(loan.total_value.amount).to be_within(0.01).of(total_principal + total_interest)
    end

    it 'returns a positive Money object' do
      expect(loan.total_value).to be_a(Money)
      expect(loan.total_value.amount).to be > 0
    end

    it 'uses the loan currency' do
      expect(loan.total_value.currency.iso_code).to eq("PHP")
    end

    it 'calculates correct total value for 9.4M PHP over 240 months at 8%' do
      # For a 9.4M loan at 8% over 240 months:
      # - Monthly payment: ~78,625.37 PHP
      # - Total value should be ~18,885,832 PHP (principal + ~9,485,836 interest)
      # - Total value = monthly_payment × 240 months
      
      expect(loan.total_value.amount).to be_within(100_000).of(18_885_832)
      
      # Tight bounds for confidence: 18.8M < total_value < 18.9M
      expect(loan.total_value.amount).to be > 18_800_000
      expect(loan.total_value.amount).to be < 18_900_000
    end

    context 'with actual payments made' do
      before do
        create(
          :loan_payment,
          loan: loan,
          principal_payment_cents: 500_000_00,
          interest_payment_cents: 50_000_00,
          total_payment_cents: 550_000_00,
          date: Date.new(2024, 2, 1)
        )
      end

      it 'reflects remaining schedule including actual payments' do
        schedule = loan.generate_amortization_schedule
        expected_total = schedule.sum { |entry| entry[:payment_amount] }
        
        expect(loan.total_value.amount).to be_within(0.01).of(expected_total)
      end
    end
  end

  describe '#generate_amortization_schedule' do
    let(:loan) do
      create(
        :loan,
        principal_amount_cents: 100_000_00,
        outstanding_balance_cents: 100_000_00,
        interest_rate: 10.0,
        loan_term_months: 12,
        date: Date.new(2024, 1, 1),
        maturity_date: Date.new(2024, 12, 31),
        currency: "PHP"
      )
    end

    context 'when loan has no payments' do
      it 'generates projected payments for the full term' do
        schedule = loan.generate_amortization_schedule
        expect(schedule).to be_an(Array)
        expect(schedule.length).to be > 0
        expect(schedule.all? { |entry| entry[:is_actual] == false }).to be true
      end

      it 'includes required fields in each entry' do
        schedule = loan.generate_amortization_schedule
        first_entry = schedule.first

        expect(first_entry).to include(
          :payment_date,
          :beginning_balance,
          :payment_amount,
          :principal_payment,
          :interest_payment,
          :ending_balance,
          :is_actual
        )
      end

      it 'first payment date is one month after loan date' do
        schedule = loan.generate_amortization_schedule
        first_entry = schedule.first

        expect(first_entry[:payment_date]).to eq(Date.new(2024, 2, 1))
      end
    end

    context 'when loan has actual payments' do
      let!(:payment1) do
        create(
          :loan_payment,
          loan: loan,
          account: loan.account,
          date: Date.new(2024, 2, 1),
          principal_payment_cents: 8_000_00,
          interest_payment_cents: 833_33,
          total_payment_cents: 8_833_33,
          currency: "PHP"
        )
      end

      let!(:payment2) do
        create(
          :loan_payment,
          loan: loan,
          account: loan.account,
          date: Date.new(2024, 3, 1),
          principal_payment_cents: 8_100_00,
          interest_payment_cents: 750_00,
          total_payment_cents: 8_850_00,
          currency: "PHP"
        )
      end

      it 'includes actual payments with is_actual true' do
        schedule = loan.generate_amortization_schedule
        actual_payments = schedule.select { |entry| entry[:is_actual] == true }

        expect(actual_payments.length).to eq(2)
        expect(actual_payments.map { |p| p[:payment_date] }).to include(payment1.date, payment2.date)
      end

      it 'includes projected payments after actual payments' do
        schedule = loan.generate_amortization_schedule
        projected_payments = schedule.select { |entry| entry[:is_actual] == false }

        expect(projected_payments.length).to be > 0
      end
    end

    context 'when principal is zero or negative' do
      it 'returns empty schedule' do
        loan = build(:loan, principal_amount_cents: 0)
        # Bypass validations to test the method behavior
        loan.save(validate: false)
        schedule = loan.generate_amortization_schedule
        expect(schedule).to eq([])
      end
    end

    context 'when loan_term_months is zero or negative' do
      it 'returns empty schedule' do
        loan = build(:loan, loan_term_months: 0)
        # Bypass validations to test the method behavior
        loan.save(validate: false)
        schedule = loan.generate_amortization_schedule
        expect(schedule).to eq([])
      end
    end

    context 'when using custom date range' do
      it 'generates schedule for the specified date range' do
        from_date = Date.new(2024, 2, 1)
        to_date = Date.new(2024, 6, 1)

        schedule = loan.generate_amortization_schedule(from_date, to_date)
        expect(schedule.all? { |entry| entry[:payment_date] >= from_date && entry[:payment_date] <= to_date }).to be true
      end
    end
  end
end
