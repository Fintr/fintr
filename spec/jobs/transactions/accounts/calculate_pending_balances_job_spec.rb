# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Accounts::CalculatePendingBalancesJob, type: :job do
  describe '#perform' do
    subject(:job) { described_class.new }

    let(:operation_instance) { instance_spy(Transactions::Accounts::Operations::CalculateBalance) }
    let(:today) { Date.new(2023, 5, 15) }

    before do
      allow(Time.zone).to receive(:today).and_return(today)
      allow(Transactions::Accounts::Operations::CalculateBalance).to receive(:new).and_return(operation_instance)
      allow(operation_instance).to receive(:call)
    end

    context 'when there are pending transactions for today' do
      let!(:pending_transaction1) { create(:transaction, balance_state: 'pending', date: today) }
      let!(:pending_transaction2) { create(:transaction, balance_state: 'pending', date: today) }

      it 'processes each pending transaction with CalculateBalance operation' do
        job.perform

        expect(operation_instance).to have_received(:call).with(params: { transaction_id: pending_transaction1.id })
        expect(operation_instance).to have_received(:call).with(params: { transaction_id: pending_transaction2.id })
      end
    end

    context 'when there are no pending transactions for today' do
      before do
        # Create transactions that are not pending or not for today
        create(:transaction, balance_state: 'calculated', date: today)
        create(:transaction, balance_state: 'pending', date: today + 1.day)
      end

      it 'does not call the CalculateBalance operation' do
        job.perform

        expect(operation_instance).not_to have_received(:call)
      end
    end

    context 'when operation succeeds for some transactions and fails for others' do
      let!(:pending_transaction1) { create(:transaction, balance_state: 'pending', date: today) }
      let!(:pending_transaction2) { create(:transaction, balance_state: 'pending', date: today) }

      before do
        allow(operation_instance).to receive(:call).with(params: { transaction_id: pending_transaction1.id })
          .and_return(Dry::Monads::Success())
        allow(operation_instance).to receive(:call).with(params: { transaction_id: pending_transaction2.id })
          .and_return(Dry::Monads::Failure(account: 'not found'))
      end

      it 'continues processing all transactions' do
        job.perform

        expect(operation_instance).to have_received(:call).with(params: { transaction_id: pending_transaction1.id })
        expect(operation_instance).to have_received(:call).with(params: { transaction_id: pending_transaction2.id })
      end
    end
  end
end
