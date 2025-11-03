# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Transfers::CalculatePendingBalancesJob, type: :job do
  describe '#perform' do
    subject(:job) { described_class.new }

    let(:operation_instance) { instance_spy(Transactions::Operations::Transfers::CalculateBalances) }
    let(:today) { Date.new(2023, 5, 15) }

    let(:space) { create(:space) }
    let(:from_account) { create(:account, space:) }
    let(:to_account) { create(:account, space:) }

    before do
      allow(Utils::Dates).to receive(:current_date_in_manila).and_return(today)
      allow(Transactions::Operations::Transfers::CalculateBalances).to receive(:new).and_return(operation_instance)
    end

    context 'when there are pending transfers' do
      let!(:pending_transfer1) { create(:transfer, balance_state: 'pending', from_account:, to_account:, date: today) }
      let!(:pending_transfer2) { create(:transfer, balance_state: 'pending', from_account:, to_account:, date: today) }
      let!(:calculated_transfer) { create(:transfer, balance_state: 'calculated', from_account:, to_account:, date: today) }
      let!(:future_transfer) { create(:transfer, balance_state: 'pending', from_account:, to_account:, date: today + 1.day) }

      it 'processes only pending transfers for today' do
        job.perform

        expect(operation_instance).to have_received(:call).with({ transfer_id: pending_transfer1.id })
        expect(operation_instance).to have_received(:call).with({ transfer_id: pending_transfer2.id })
        expect(operation_instance).not_to have_received(:call).with({ transfer_id: calculated_transfer.id })
        expect(operation_instance).not_to have_received(:call).with({ transfer_id: future_transfer.id })
      end
    end

    context 'when operation succeeds for some transfers and fails for others' do
      let!(:pending_transfer1) { create(:transfer, balance_state: 'pending', from_account:, to_account:, date: today) }
      let!(:pending_transfer2) { create(:transfer, balance_state: 'pending', from_account:, to_account:, date: today) }

      before do
        allow(operation_instance).to receive(:call).with({ transfer_id: pending_transfer1.id })
          .and_return(Dry::Monads::Success())
        allow(operation_instance).to receive(:call).with({ transfer_id: pending_transfer2.id })
          .and_return(Dry::Monads::Failure(account: 'not found'))
      end

      it 'continues processing all transfers' do
        job.perform

        expect(operation_instance).to have_received(:call).with({ transfer_id: pending_transfer1.id })
        expect(operation_instance).to have_received(:call).with({ transfer_id: pending_transfer2.id })
      end
    end

    context 'when there are no pending transfers' do
      it 'does not call the operation' do
        job.perform
        expect(operation_instance).not_to have_received(:call)
      end
    end
  end
end
