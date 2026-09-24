# frozen_string_literal: true

module Transactions
  module Operations
    class MaterializeSeriesChildren < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction_id).value(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params      = step validate(params:)
        transaction = step find_transaction(params:)
        root        = step resolve_root(transaction:)
        return Success([]) if root.one_time?

        _ = step refresh_installment_schedule(root:)
        _ = step materialize_past(root:)
        _ = step materialize_future(root:)
        step load_series(root:)
      end

      private

      def find_transaction(params:)
        transaction = Transaction.find(params[:transaction_id])
        Success(transaction)
      rescue ActiveRecord::RecordNotFound => e
        Failure(transaction_id: "not found", error: e, expected: true)
      end

      def resolve_root(transaction:)
        Success(transaction.root_parent)
      end

      def refresh_installment_schedule(root:)
        return Success(root) unless root.installment?

        period = root.installment_period.to_i
        return Success(root) if period <= 0

        schedule = Utils::Recurrence.schedule(
          repeat_interval: :installment,
          date: root.date,
          installment_period: period,
        )
        root.update!(schedule: schedule.to_hash)
        Success(root)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(error: e)
      end

      def load_series(root:)
        Success(root.series_records.order(:date, :created_at).to_a)
      end

      def materialize_past(root:)
        return Success([]) unless root.date < Time.zone.today

        CreateRepeatTransactions.new.call(
          transaction_id: root.id,
          balance_state: "calculated",
          date_start: (root.date + 1.day).beginning_of_day.to_datetime,
          date_end: Time.zone.today,
          suppress_actor_toast: true,
        )
      end

      def materialize_future(root:)
        CreateRepeatTransactions.new.call(
          transaction_id: root.id,
          balance_state: "pending",
          date_start: Time.zone.tomorrow,
          date_end: Utils::Recurrence.future_series_end_date(
            record: root,
            reference_date: Time.zone.today,
          ),
          suppress_actor_toast: true,
        )
      end
    end
  end
end
