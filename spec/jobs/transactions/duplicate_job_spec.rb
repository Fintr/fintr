# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::DuplicateJob, type: :job do
  describe '#perform' do
    subject(:job) { described_class.new }

    let(:transaction_id) { 'transaction-123' }
    let(:operation_instance) { instance_spy(Transactions::Operations::CreateRepeatTransactions) }
    let(:today) { Date.new(2023, 5, 15) }

    before do
      allow(Utils::Dates).to receive(:current_date_in_manila).and_return(today)
      allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(operation_instance)
    end

    it 'calls CreateRepeatTransactions with the correct parameters' do
      allow(operation_instance).to receive(:call).and_return(Dry::Monads::Success(nil))

      job.perform(transaction_id)

      expect(operation_instance).to have_received(:call).with(
        transaction_id: transaction_id,
        date_start: today + 1.month,
        date_end: today + 1.month
      )
    end

    context 'when operation succeeds' do
      let(:operation_result) { Dry::Monads::Success(nil) }

      before do
        allow(operation_instance).to receive(:call).and_return(operation_result)
      end

      it 'completes without raising errors' do
        expect { job.perform(transaction_id) }.not_to raise_error
      end
    end

    context 'when operation fails' do
      let(:operation_result) { Dry::Monads::Failure(transaction_id: 'not found') }

      before do
        allow(operation_instance).to receive(:call).and_return(operation_result)
      end

      it 'completes without raising errors' do
        expect { job.perform(transaction_id) }.not_to raise_error
      end
    end
  end
end
