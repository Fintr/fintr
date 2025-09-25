# frozen_string_literal: true

require 'rails_helper'

RSpec.describe MonthlyFinancialSummaries::Queries::CurrentMonthSummary, type: :query do
  include Dry::Monads[:result]

  let!(:space) { create(:personal_space, code: 'test-space') }
  let!(:other_space) { create(:personal_space, code: 'other-space') }

  let(:valid_params) { { space_code: space.code } }

  describe '#validate' do
    context 'when params are valid' do
      subject(:validation_result) { described_class.new(params: valid_params).validate(valid_params) }

      it 'returns a success' do
        expect(validation_result).to be_success
      end

      it 'returns the validated params hash' do
        expect(validation_result.value!).to eq(valid_params)
      end
    end

    context 'when space_code is missing' do
      subject(:validation_result) { described_class.new(params: {}).validate({ space_code: nil }) }

      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes :space_code in failure details' do
        expect(validation_result.failure).to include(space_code: ['must be a string'])
      end
    end

    context 'when space_code is not a string' do
      subject(:validation_result) { described_class.new(params: { space_code: 123 }).validate({ space_code: 123 }) }

      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes :space_code type error in failure details' do
        expect(validation_result.failure).to include(space_code: ['must be a string'])
      end
    end

    context 'when space_code is empty string' do
      subject(:validation_result) { described_class.new(params: { space_code: '' }).validate({ space_code: '' }) }

      it 'returns a success' do
        expect(validation_result).to be_success
      end

      it 'returns the validated params hash' do
        expect(validation_result.value!).to eq({ space_code: '' })
      end
    end
  end

  describe '#call' do
    subject(:query_result) { described_class.new(params: query_params).call }

    context 'with valid space_code' do
      let(:query_params) { valid_params }

      it 'succeeds' do
        expect(query_result).to be_success
      end

      it 'returns a monthly financial summary' do
        summary = query_result.value!
        expect(summary).to be_a(MonthlyFinancialSummary)
        expect(summary.space).to eq(space)
        expect(summary.year).to eq(Date.current.year)
        expect(summary.month).to eq(Date.current.month)
      end

      it 'creates a new summary if one does not exist' do
        expect { query_result }.to change(MonthlyFinancialSummary, :count).by(1)
      end

      it 'finds existing summary if one already exists' do
        existing_summary = create(:monthly_financial_summary, space:, year: Date.current.year, month: Date.current.month)

        expect { query_result }.not_to change(MonthlyFinancialSummary, :count)

        summary = query_result.value!
        expect(summary).to eq(existing_summary)
      end
    end

    context 'when space does not exist' do
      let(:query_params) { { space_code: 'non-existent-space' } }

      it 'returns a failure' do
        expect(query_result).to be_failure
      end

      it 'returns space_code error' do
        expect(query_result.failure).to include(space_code: 'Space not found')
      end
    end

    context 'when space_code is nil' do
      let(:query_params) { { space_code: nil } }

      it 'returns a failure' do
        expect(query_result).to be_failure
      end

      it 'returns validation error' do
        expect(query_result.failure).to include(space_code: ['must be a string'])
      end
    end

    context 'when database error occurs during summary creation' do
      let(:query_params) { valid_params }

      before do
        allow(MonthlyFinancialSummary).to receive(:find_or_create_for_space_and_month)
          .and_raise(ActiveRecord::ActiveRecordError.new('Database error'))
      end

      it 'returns a failure' do
        expect(query_result).to be_failure
      end

      it 'returns error details' do
        expect(query_result.failure).to include(
          summary: 'Failed to get current month summary',
          error: 'Database error'
        )
      end
    end
  end

  describe 'Private Methods' do
    let(:query) { described_class.new(params: valid_params) }

    describe '#find_space' do
      it 'finds existing space' do
        result = query.send(:find_space)
        expect(result).to be_success
        expect(result.value!).to eq(space)
      end

      it 'fails when space not found' do
        query_with_invalid_space = described_class.new(params: { space_code: 'non-existent' })
        result = query_with_invalid_space.send(:find_space)
        expect(result).to be_failure
        expect(result.failure).to include(space_code: 'Space not found')
      end
    end

    describe '#find_or_create_current_summary' do
      it 'creates summary for current month' do
        result = query.send(:find_or_create_current_summary, space:)
        expect(result).to be_success

        summary = result.value!
        expect(summary).to be_a(MonthlyFinancialSummary)
        expect(summary.space).to eq(space)
        expect(summary.year).to eq(Date.current.year)
        expect(summary.month).to eq(Date.current.month)
      end

      it 'finds existing summary' do
        existing_summary = create(:monthly_financial_summary, space:, year: Date.current.year, month: Date.current.month)

        result = query.send(:find_or_create_current_summary, space:)
        expect(result).to be_success
        expect(result.value!).to eq(existing_summary)
      end

      it 'handles database errors' do
        allow(MonthlyFinancialSummary).to receive(:find_or_create_for_space_and_month)
          .and_raise(ActiveRecord::ActiveRecordError.new('Database connection failed'))

        result = query.send(:find_or_create_current_summary, space:)
        expect(result).to be_failure
        expect(result.failure).to include(
          summary: 'Failed to get current month summary',
          error: 'Database connection failed'
        )
      end
    end
  end
end
