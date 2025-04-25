# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::CheckDuplicateTodayJob, type: :job do
  subject(:job) { described_class.new }

  describe '#perform' do
    let(:transaction) { create(:transaction, schedule: schedule_hash) }
    let(:schedule_hash) { {} }

    before do
      allow(Rails.logger).to receive(:info)
    end

    context 'when transaction has no schedule' do
      it 'does not call DuplicateJob' do
        expect(Transactions::DuplicateJob).not_to receive(:perform_later)

        job.perform
      end
    end

    context 'when transaction has schedule that occurs today' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new
        schedule.add_recurrence_rule(IceCube::Rule.daily)
        schedule.to_hash
      end

      it 'calls DuplicateJob with transaction id' do
        expect(Transactions::DuplicateJob).to receive(:perform_later).with(transaction.id)

        job.perform
      end
    end

    context 'when transaction has schedule that does not occur today' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new
        schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:monday))
        # Ensure the test doesn't run on a Monday to make it reliable
        allow(Time.zone).to receive(:today).and_return(Date.new(2023, 1, 3)) # This is a Tuesday
        schedule.to_hash
      end

      it 'does not call DuplicateJob' do
        expect(Transactions::DuplicateJob).not_to receive(:perform_later)

        job.perform
      end
    end
  end
end
