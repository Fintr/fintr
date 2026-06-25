# frozen_string_literal: true

require 'rails_helper'

RSpec.describe MonthlyFinancialSummary, type: :model do
  let(:space) { create(:space) }
  let(:current_date) { Date.current }

  describe 'associations' do
    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
  end

  describe 'validations' do
    subject(:summary) { build(:monthly_financial_summary, space: space) }

    describe 'year' do
      it 'is valid with a year between 2001 and 2099' do
        summary.year = 2024
        expect(summary).to be_valid
      end

      it 'is invalid with a year less than 2001' do
        summary.year = 2000
        expect(summary).not_to be_valid
        expect(summary.errors[:year]).to include('must be greater than 2000')
      end

      it 'is invalid with a year greater than 2099' do
        summary.year = 2100
        expect(summary).not_to be_valid
        expect(summary.errors[:year]).to include('must be less than 2100')
      end

      it 'is invalid without a year' do
        summary.year = nil
        expect(summary).not_to be_valid
        expect(summary.errors[:year]).to include("can't be blank")
      end
    end

    describe 'month' do
      it 'is valid with a month between 1 and 12' do
        summary.month = 6
        expect(summary).to be_valid
      end

      it 'is invalid with a month less than 1' do
        summary.month = 0
        expect(summary).not_to be_valid
        expect(summary.errors[:month]).to include('must be greater than 0')
      end

      it 'is invalid with a month greater than 12' do
        summary.month = 13
        expect(summary).not_to be_valid
        expect(summary.errors[:month]).to include('must be less than 13')
      end

      it 'is invalid without a month' do
        summary.month = nil
        expect(summary).not_to be_valid
        expect(summary.errors[:month]).to include("can't be blank")
      end
    end

    describe 'total_income' do
      it 'is valid with a non-negative value' do
        summary.total_income = 1000.00
        expect(summary).to be_valid
      end

      it 'is invalid with a negative value' do
        summary.total_income = -100.00
        expect(summary).not_to be_valid
        expect(summary.errors[:total_income]).to include('must be greater than or equal to 0')
      end

      it 'is invalid without total_income' do
        summary.total_income = nil
        expect(summary).not_to be_valid
        expect(summary.errors[:total_income]).to include("can't be blank")
      end
    end

    describe 'total_expenses' do
      it 'is valid with a non-negative value' do
        summary.total_expenses = 500.00
        expect(summary).to be_valid
      end

      it 'is invalid with a negative value' do
        summary.total_expenses = -50.00
        expect(summary).not_to be_valid
        expect(summary.errors[:total_expenses]).to include('must be greater than or equal to 0')
      end

      it 'is invalid without total_expenses' do
        summary.total_expenses = nil
        expect(summary).not_to be_valid
        expect(summary.errors[:total_expenses]).to include("can't be blank")
      end
    end

    describe 'net_savings' do
      it 'is invalid without net_savings' do
        summary.net_savings = nil
        expect(summary).not_to be_valid
        expect(summary.errors[:net_savings]).to include("can't be blank")
      end
    end

    describe 'calculated_at' do
      it 'is invalid without calculated_at' do
        summary.calculated_at = nil
        expect(summary).not_to be_valid
        expect(summary.errors[:calculated_at]).to include("can't be blank")
      end
    end

    describe 'space_id uniqueness' do
      it 'is valid with unique space_id, year, and month combination' do
        create(:monthly_financial_summary, space: space, year: 2024, month: 6)
        summary.year = 2024
        summary.month = 7
        expect(summary).to be_valid
      end

      it 'is invalid with duplicate space_id, year, and month combination' do
        create(:monthly_financial_summary, space: space, year: 2024, month: 6)
        summary.year = 2024
        summary.month = 6
        expect(summary).not_to be_valid
        expect(summary.errors[:space_id]).to include('has already been taken')
      end
    end
  end

  describe 'scopes' do
    let!(:current_summary) { create(:monthly_financial_summary, :current_month, space: space) }
    let!(:previous_summary) { create(:monthly_financial_summary, :previous_month, space: space) }
    let!(:other_space_summary) { create(:monthly_financial_summary, :current_month) }

    describe '.for_space' do
      it 'returns summaries for the specified space' do
        expect(described_class.for_space(space)).to include(current_summary, previous_summary)
        expect(described_class.for_space(space)).not_to include(other_space_summary)
      end
    end

    describe '.for_month' do
      it 'returns summaries for the specified year and month' do
        expect(described_class.for_month(current_date.year, current_date.month)).to include(current_summary, other_space_summary)
        expect(described_class.for_month(current_date.year, current_date.month)).not_to include(previous_summary)
      end
    end

    describe '.current_month' do
      it 'returns summaries for the current month' do
        expect(described_class.current_month).to include(current_summary, other_space_summary)
        expect(described_class.current_month).not_to include(previous_summary)
      end
    end

    describe '.recent' do
      it 'returns summaries ordered by year and month descending' do
        summaries = described_class.recent
        expect(summaries.first.year).to be >= summaries.last.year
        if summaries.first.year == summaries.last.year
          expect(summaries.first.month).to be >= summaries.last.month
        end
      end
    end
  end

  describe '.find_or_create_for_space_and_month' do
    let(:space) { create(:space) }
    let(:year) { 2024 }
    let(:month) { 6 }

    context 'when summary does not exist' do
      it 'creates a new summary' do
        expect {
          described_class.find_or_create_for_space_and_month(space: space, year: year, month: month)
        }.to change(described_class, :count).by(1)
      end

      it 'sets the correct attributes' do
        summary = described_class.find_or_create_for_space_and_month(space: space, year: year, month: month)
        expect(summary.space_id).to eq(space.id)
        expect(summary.year).to eq(year)
        expect(summary.month).to eq(month)
        expect(summary.calculated_at).to be_present
      end

      it 'recalculates the summary when it is new' do
        summary = described_class.find_or_create_for_space_and_month(space: space, year: year, month: month)
        expect(summary.total_income).to be >= 0
        expect(summary.total_expenses).to be >= 0
        expect(summary.calculated_at).to be_present
      end
    end

    context 'when summary already exists' do
      let!(:existing_summary) { create(:monthly_financial_summary, space: space, year: year, month: month) }

      it 'returns the existing summary' do
        summary = described_class.find_or_create_for_space_and_month(space: space, year: year, month: month)
        expect(summary).to eq(existing_summary)
      end

      it 'does not create a new summary' do
        expect {
          described_class.find_or_create_for_space_and_month(space: space, year: year, month: month)
        }.not_to change(described_class, :count)
      end

      it 'recalculates the existing summary' do
        allow(MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange).to receive(:call)
          .and_return(
            {
              total_income: 1000.to_d,
              total_expenses: 500.to_d,
              net_savings: 500.to_d
            }
          )
        described_class.find_or_create_for_space_and_month(space: space, year: year, month: month)
        expect(MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange).to have_received(:call)
      end
    end

    context 'when using default parameters' do
      it 'uses current year and month as defaults' do
        summary = described_class.find_or_create_for_space_and_month(space: space)
        expect(summary.year).to eq(Date.current.year)
        expect(summary.month).to eq(Date.current.month)
      end
    end

    context 'when two processes create the same summary concurrently' do
      it 'recovers from a uniqueness violation and returns one summary' do
        allow(described_class).to receive(:find_by).and_return(nil)
        allow(described_class).to receive(:create!).and_raise(ActiveRecord::RecordNotUnique)
        existing_summary = create(:monthly_financial_summary, space: space, year: year, month: month)
        allow(described_class).to receive(:find_by!).and_return(existing_summary)
        allow(existing_summary).to receive(:recalculate!)

        summary = described_class.find_or_create_record_for_space_and_month(
          space: space,
          year: year,
          month: month
        )

        expect(summary).to eq(existing_summary)
      end
    end
  end

  describe '.recalculate_for_space_and_month!' do
    it 'finds or creates the summary and recalculates under lock' do
      create(:monthly_financial_summary, space: space, year: 2024, month: 6)
      allow(MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange).to receive(:call)
        .and_return(
          {
            total_income: 1000.to_d,
            total_expenses: 500.to_d,
            net_savings: 500.to_d
          }
        )

      expect_any_instance_of(described_class).to receive(:with_lock).and_call_original

      described_class.recalculate_for_space_and_month!(
        space: space,
        year: 2024,
        month: 6
      )
    end
  end

  describe '.apply_totals_for_space_and_month!' do
    it 'persists totals under row lock' do
      create(:monthly_financial_summary, space: space, year: 2024, month: 6)
      totals = {
        total_income: 1000.to_d,
        total_expenses: 500.to_d,
        net_savings: 500.to_d
      }

      expect_any_instance_of(described_class).to receive(:with_lock).and_call_original

      described_class.apply_totals_for_space_and_month!(
        space: space,
        year: 2024,
        month: 6,
        totals:
      )
    end

    it 'does not create a summary when totals are empty' do
      totals = {
        total_income: 0.to_d,
        total_expenses: 0.to_d,
        net_savings: 0.to_d
      }

      expect {
        described_class.apply_totals_for_space_and_month!(
          space: space,
          year: 2000,
          month: 1,
          totals:
        )
      }.not_to change(described_class, :count)
    end
  end

  describe '#recalculate!' do
    let(:summary) { create(:monthly_financial_summary, space: space) }

    before do
      allow(MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange).to receive(:call)
        .and_return(
          {
            total_income: 1000.to_d,
            total_expenses: 500.to_d,
            net_savings: 500.to_d
          }
        )
    end

    it 'updates the financial totals' do
      expect(summary).to receive(:with_lock).and_call_original
      summary.recalculate!
      expect(summary.total_income).to eq(1000.to_d)
      expect(summary.total_expenses).to eq(500.to_d)
      expect(summary.net_savings).to eq(500.to_d)
    end

    it 'updates the calculated_at timestamp' do
      old_timestamp = summary.calculated_at
      travel_to(1.hour.from_now) do
        summary.recalculate!
        expect(summary.calculated_at).to be > old_timestamp
      end
    end
  end

  describe '#savings_percentage' do
    context 'when total_income is zero' do
      it 'returns 0' do
        summary = build(:monthly_financial_summary, total_income: 0.00)
        expect(summary.savings_percentage).to eq(0)
      end
    end

    context 'when total_income is positive' do
      it 'calculates the correct percentage' do
        summary = build(:monthly_financial_summary, total_income: 1000.00, net_savings: 200.00)
        expect(summary.savings_percentage).to eq(20.0)
      end

      it 'rounds to 2 decimal places' do
        summary = build(:monthly_financial_summary, total_income: 1000.00, net_savings: 333.33)
        expect(summary.savings_percentage).to eq(33.33)
      end

      it 'handles negative savings' do
        summary = build(:monthly_financial_summary, total_income: 1000.00, net_savings: -100.00)
        expect(summary.savings_percentage).to eq(-10.0)
      end
    end
  end

  describe 'private methods' do
    let(:summary) { create(:monthly_financial_summary, space: space, year: 2024, month: 6) }

    before do
      allow(MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange).to receive(:call)
        .and_return(
          {
            total_income: 1000.to_d,
            total_expenses: 300.to_d,
            net_savings: 700.to_d
          }
        )
    end

    describe '#recalculate!' do
      it 'uses FX-aware monthly aggregation' do
        summary.recalculate!

        expect(MonthlyFinancialSummaries::Queries::AggregateTotalsInSpaceForRange).to have_received(:call).with(
          space: having_attributes(id: space.id),
          start_date: Date.new(2024, 6, 1),
          end_date: Date.new(2024, 6, 30)
        )
        expect(summary.reload.fx_based).to be(true)
      end
    end
  end
end
