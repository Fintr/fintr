# frozen_string_literal: true

require 'rails_helper'

RSpec.describe MonthlyFinancialSummaries::Operations::UpdateSummary do
  let(:operation) { described_class.new }
  let!(:space) { create(:space) }
  let(:transaction_date) { Date.current }

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    context 'when the update is successful' do
      let(:params) do
        {
          space_id: space.id.to_s,
          transaction_date: transaction_date
        }
      end

      it { is_expected.to be_success }

      it 'returns the updated summary' do
        result = call_operation.value!
        expect(result).to be_a(MonthlyFinancialSummary)
        expect(result.space_id).to eq(space.id)
        expect(result.year).to eq(transaction_date.year)
        expect(result.month).to eq(transaction_date.month)
      end

      it 'creates a new summary if one does not exist' do
        expect { call_operation }.to change(MonthlyFinancialSummary, :count).by(1)
      end

      it 'finds existing summary if one already exists' do
        existing_summary = create(:monthly_financial_summary, space: space, year: transaction_date.year, month: transaction_date.month)

        expect { call_operation }.not_to change(MonthlyFinancialSummary, :count)

        result = call_operation.value!
        expect(result.id).to eq(existing_summary.id)
      end

      it 'calls recalculate! on the summary' do
        summary = instance_double(MonthlyFinancialSummary)
        allow(MonthlyFinancialSummary).to receive(:find_or_create_for_space_and_month).and_return(summary)
        expect(summary).to receive(:recalculate!)

        call_operation
      end
    end

    context 'with validation errors' do
      context 'when space_id is missing' do
        let(:params) do
          {
            transaction_date: transaction_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when transaction_date is missing' do
        let(:params) do
          {
            space_id: space.id.to_s
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with transaction_date missing error' do
          expect(call_operation.failure).to eq({ transaction_date: ['is missing'] })
        end
      end

      context 'when space_id is not a string' do
        let(:params) do
          {
            space_id: space.id,
            transaction_date: transaction_date
          }
        end

        it { is_expected.to be_success }

        it 'converts space_id to string and succeeds' do
          result = call_operation.value!
          expect(result).to be_a(MonthlyFinancialSummary)
        end
      end

      context 'when transaction_date is not a date' do
        let(:params) do
          {
            space_id: space.id.to_s,
            transaction_date: 'not-a-date'
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with transaction_date type error' do
          expect(call_operation.failure).to eq({ transaction_date: ['must be a date'] })
        end
      end
    end

    context 'when the space is not found' do
      let(:params) do
        {
          space_id: '999999',
          transaction_date: transaction_date
        }
      end

      it { is_expected.to be_failure }

      it 'returns a failure with space not found error' do
        expect(call_operation.failure).to include(space_id: 'Space not found')
      end

      it 'includes the error message' do
        expect(call_operation.failure).to include(:error)
      end
    end

    context 'when recalculate! fails' do
      let(:params) do
        {
          space_id: space.id.to_s,
          transaction_date: transaction_date
        }
      end
      let(:summary) { instance_double(MonthlyFinancialSummary) }

      before do
        allow(MonthlyFinancialSummary).to receive(:find_or_create_for_space_and_month).and_return(summary)
        allow(summary).to receive(:recalculate!).and_raise(ActiveRecord::ActiveRecordError.new('Database error'))
      end

      it { is_expected.to be_failure }

      it 'returns a failure with summary recalculate error' do
        expect(call_operation.failure).to include(summary: 'Failed to recalculate')
      end

      it 'includes the error message' do
        expect(call_operation.failure).to include(:error)
      end
    end
  end

  describe '#validate' do
    subject(:validate_params) { operation.validate(params: params) }

    context 'with valid parameters' do
      let(:params) do
        {
          space_id: space.id.to_s,
          transaction_date: transaction_date
        }
      end

      it { is_expected.to be_success }

      it 'returns the validated parameters' do
        result = validate_params.value!
        expect(result[:space_id]).to eq(space.id.to_s)
        expect(result[:transaction_date]).to eq(transaction_date)
      end
    end

    context 'with invalid parameters' do
      context 'when space_id is missing' do
        let(:params) do
          {
            transaction_date: transaction_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          expect(validate_params.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when transaction_date is missing' do
        let(:params) do
          {
            space_id: space.id.to_s
          }
        end

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          expect(validate_params.failure).to eq({ transaction_date: ['is missing'] })
        end
      end
    end
  end

  describe '#find_or_create_summary' do
    subject(:find_or_create_summary) { operation.send(:find_or_create_summary, params: params) }

    let(:params) do
      {
        space_id: space.id.to_s,
        transaction_date: transaction_date
      }
    end

    it { is_expected.to be_success }

    it 'returns a MonthlyFinancialSummary' do
      result = find_or_create_summary.value!
      expect(result).to be_a(MonthlyFinancialSummary)
    end

    it 'calls find_or_create_for_space_and_month with correct parameters' do
      # rubocop:disable RSpec/StubbedMock
      expect(MonthlyFinancialSummary).to receive(:find_or_create_for_space_and_month)
        .with(space: be_a(Spaces::Space), year: transaction_date.year, month: transaction_date.month)
        .and_return(instance_double(MonthlyFinancialSummary))
      # rubocop:enable RSpec/StubbedMock

      find_or_create_summary
    end

    context 'when space is not found' do
      let(:params) do
        {
          space_id: '999999',
          transaction_date: transaction_date
        }
      end

      it { is_expected.to be_failure }

      it 'returns space not found error' do
        expect(find_or_create_summary.failure).to include(space_id: 'Space not found')
      end
    end
  end

  describe '#recalculate_summary' do
    subject(:recalculate_summary) { operation.send(:recalculate_summary, summary: summary) }

    let(:summary) { create(:monthly_financial_summary, space: space) }

    it { is_expected.to be_success }

    it 'returns the summary' do
      result = recalculate_summary.value!
      expect(result).to eq(summary)
    end

    it 'calls recalculate! on the summary' do
      expect(summary).to receive(:recalculate!)
      recalculate_summary
    end

    context 'when recalculate! raises an error' do
      before do
        allow(summary).to receive(:recalculate!).and_raise(ActiveRecord::ActiveRecordError.new('Database error'))
      end

      it { is_expected.to be_failure }

      it 'returns recalculate error' do
        expect(recalculate_summary.failure).to include(summary: 'Failed to recalculate')
      end

      it 'includes the error message' do
        expect(recalculate_summary.failure).to include(:error)
      end
    end
  end
end
