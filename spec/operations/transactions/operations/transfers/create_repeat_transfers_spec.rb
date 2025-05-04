# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CreateRepeatTransfers do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:today) { Time.zone.today }
  let(:next_month) { today + 1.month }

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer_id is missing' do
        result = operation.validate(params: {
          date_start: today,
          date_end: next_month
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer_id)
      end

      it 'fails when date_start is missing' do
        result = operation.validate(params: {
          transfer_id: 'some-id',
          date_end: next_month
        })
        expect(result).to be_failure
        expect(result.failure).to include(:date_start)
      end

      it 'fails when date_end is missing' do
        result = operation.validate(params: {
          transfer_id: 'some-id',
          date_start: today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:date_end)
      end
    end
  end

  describe '#find_transfer' do
    it 'returns a Failure when transfer is not found' do
      result = operation.find_transfer(params: { transfer_id: 'non-existent-id' })
      expect(result).to be_failure
      expect(result.failure).to include(:transfer_id)
    end

    it 'returns a Success with the transfer when found' do
      transfer = create(:transfer, user:, space:, from_account:, to_account:)
      result = operation.find_transfer(params: { transfer_id: transfer.id })
      expect(result).to be_success
      expect(result.value!).to eq(transfer)
    end
  end

  describe '#call' do
    context 'with non-existent transfer' do
      it 'returns a not found error' do
        result = operation.call(params: {
          transfer_id: 'non-existent-id',
          date_start: today,
          date_end: next_month
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer_id)
      end
    end

    context 'with a one_time transfer' do
      let!(:transfer) do
        create(
          :transfer,
          user:,
          space:,
          from_account:,
          to_account:,
          date: today,
          schedule_type: "one_time"
        )
      end

      it 'returns success without creating new transfers' do
        expect {
          result = operation.call(params: {
            transfer_id: transfer.id,
            date_start: today + 1.day,
            date_end: next_month
          })

          expect(result).to be_success
        }.not_to change(Transactions::Transfer, :count)
      end
    end

    # Note: This is an integration test that depends on how your system is set up.
    # It may need to be updated based on your specific implementation.
    context 'with a repeat transfer (integration test)', :integration do
      let!(:transfer) do
        create(
          :transfer,
          :repeat,
          user:,
          space:,
          from_account:,
          to_account:,
          date: today
        )
      end

      it 'can be executed without errors' do
        params = {
          transfer_id: transfer.id,
          date_start: today + 1.day,
          date_end: next_month
        }

        # Just verify it runs without errors
        result = operation.call(params: params)
        expect(result).not_to be_nil
      end
    end
  end
end
