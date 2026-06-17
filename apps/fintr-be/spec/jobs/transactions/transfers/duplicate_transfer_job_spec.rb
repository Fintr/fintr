# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Transfers::DuplicateTransferJob, type: :job do
  describe '#perform' do
    subject(:job) { described_class.new }

    let(:transfer_id) { 'transfer-123' }
    let(:operation_instance) { instance_spy(Transactions::Operations::Transfers::CreateRepeatTransfers) }
    let(:today) { Date.new(2023, 5, 15) }

    before do
      allow(Utils::Dates).to receive(:current_date_in_manila).and_return(today)
      allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(operation_instance)
    end

    it 'calls CreateRepeatTransfers with the correct parameters' do
      job.perform(transfer_id)

      expect(operation_instance).to have_received(:call).with(
        params: {
          transfer_id: transfer_id,
          date_start: today + 1.month,
          date_end: today + 1.month,
        }
      )
    end

    context 'when operation succeeds' do
      let(:operation_result) { Dry::Monads::Success(nil) }

      before do
        allow(operation_instance).to receive(:call).and_return(operation_result)
      end

      it 'completes without raising errors' do
        expect { job.perform(transfer_id) }.not_to raise_error
      end
    end

    context 'when operation fails' do
      let(:operation_result) { Dry::Monads::Failure(transfer_id: 'not found') }

      before do
        allow(operation_instance).to receive(:call).and_return(operation_result)
      end

      it 'completes without raising errors' do
        expect { job.perform(transfer_id) }.not_to raise_error
      end
    end
  end
end
