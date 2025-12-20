# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::CheckDuplicateTodayJob, type: :job do
  subject(:job) { described_class.new }

  describe '#perform' do
    let(:transaction) { create(:transaction, schedule: schedule_hash) }
    let(:schedule_hash) { {} }
    let(:today) { Time.zone.parse("2023-05-15 12:00:00").in_time_zone("Asia/Manila") }

    before do
      allow(Rails.logger).to receive(:info)
      allow(Utils::Dates).to receive(:current_time_in_manila).and_return(today)
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

      it 'calls DuplicateJob with transaction id and today date' do
        expect(Transactions::DuplicateJob).to receive(:perform_later).with(
          transaction.id,
          today.to_date.to_s
        )

        job.perform
      end
    end

    context 'when transaction has schedule that does not occur today' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new
        schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:monday))
        schedule.to_hash
      end

      before do
        # Ensure today is not a Monday
        allow(Time.zone).to receive(:today).and_return(Date.new(2023, 5, 16)) # This is a Tuesday
      end

      it 'does not call DuplicateJob' do
        expect(Transactions::DuplicateJob).not_to receive(:perform_later)

        job.perform
      end
    end

    context 'when start_date_string is not provided' do
      let(:schedule_hash) do
        schedule = IceCube::Schedule.new
        schedule.add_recurrence_rule(IceCube::Rule.daily)
        schedule.to_hash
      end

      it 'processes only today (backward compatible behavior)' do
        expect(Transactions::DuplicateJob).to receive(:perform_later).once.with(
          transaction.id,
          today.to_date.to_s
        )

        job.perform
      end
    end

    context 'when start_date_string is provided' do
      let(:start_date_string) { "2023-05-10" }
      let(:start_date) { Date.parse(start_date_string).in_time_zone("Asia/Manila") }
      let(:end_date) { today }

      context 'when schedule occurs on multiple dates in the range' do
        let(:schedule_hash) do
          schedule = IceCube::Schedule.new
          schedule.add_recurrence_rule(IceCube::Rule.daily)
          schedule.to_hash
        end

        it 'calls DuplicateJob for each date where schedule occurs' do
          expected_dates = (start_date.to_date..end_date.to_date).to_a

          expected_dates.each do |date|
            expect(Transactions::DuplicateJob).to receive(:perform_later).with(
              transaction.id,
              date.to_s
            )
          end

          job.perform(start_date_string)
        end
      end

      context 'when schedule occurs on some dates in the range' do
        let(:schedule_hash) do
          schedule = IceCube::Schedule.new
          schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:monday, :wednesday, :friday))
          schedule.to_hash
        end

        it 'calls DuplicateJob only for dates where schedule occurs' do
          # Calculate expected dates (Mondays, Wednesdays, Fridays between start and end)
          expected_dates = (start_date.to_date..end_date.to_date).select do |date|
            [1, 3, 5].include?(date.wday) # Monday=1, Wednesday=3, Friday=5
          end

          expected_dates.each do |date|
            expect(Transactions::DuplicateJob).to receive(:perform_later).with(
              transaction.id,
              date.to_s
            )
          end

          job.perform(start_date_string)
        end
      end

      context 'when schedule does not occur in the range' do
        let(:schedule_hash) do
          schedule = IceCube::Schedule.new
          schedule.add_recurrence_rule(IceCube::Rule.weekly.day(:sunday))
          schedule.to_hash
        end

        before do
          # Ensure the date range doesn't include any Sundays
          # Set end_date to a Friday (2023-05-12 is a Friday)
          friday = Time.zone.parse("2023-05-12 12:00:00").in_time_zone("Asia/Manila")
          allow(Utils::Dates).to receive(:current_time_in_manila).and_return(friday)
        end

        it 'does not call DuplicateJob' do
          expect(Transactions::DuplicateJob).not_to receive(:perform_later)

          job.perform(start_date_string)
        end
      end

      context 'when start_date is after end_date' do
        let(:start_date_string) { "2023-05-20" } # After today (2023-05-15)

        let(:schedule_hash) do
          schedule = IceCube::Schedule.new
          schedule.add_recurrence_rule(IceCube::Rule.daily)
          schedule.to_hash
        end

        it 'does not process any dates since start_date is in the future' do
          expect(Transactions::DuplicateJob).not_to receive(:perform_later)

          job.perform(start_date_string)
        end
      end
    end
  end
end
