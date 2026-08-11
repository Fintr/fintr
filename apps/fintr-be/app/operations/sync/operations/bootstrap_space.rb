# frozen_string_literal: true

module Sync
  module Operations
    class BootstrapSpace < Dry::Operation
      BOOTSTRAP_START_DATE = Date.new(2000, 1, 1)
      BOOTSTRAP_END_DATE = Date.new(2099, 12, 31)

      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          optional(:current_user_id).maybe(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        space = step find_space(params:)
        current_user = step resolve_current_user(params:)
        latest_seq = step resolve_latest_seq(space:)

        accounts = step load_accounts(space:)
        categories = step load_categories(space:)
        transactions = step load_transactions(space:)
        summaries = step load_monthly_summaries(space:)
        loans = step load_loans(space:)
        budgets_by_month = step load_budgets_by_month(space:, transactions:)
        space_payload = step serialize_space(space:, current_user:)

        _ = step verify_latest_seq_unchanged(space:, expected_seq: latest_seq)

        {
          space_id: space.id,
          latest_seq:,
          snapshot_id: SecureRandom.uuid,
          generated_at: Time.current.iso8601(3),
          totals: {
            transactions: transactions.length,
            loans: loans.length,
            budget_months: budgets_by_month.length,
            truncated: false,
          },
          space: space_payload,
          accounts:,
          categories:,
          transactions:,
          monthly_financial_summaries: summaries,
          loans:,
          budgets_by_month:,
        }
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_space(params:)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space_id: "not found") if space.blank?

        Success(space)
      end

      def resolve_current_user(params:)
        user_id = params[:current_user_id].to_s.strip
        return Success(nil) if user_id.blank?

        Success(Auth::User.find_by(id: user_id))
      end

      def resolve_latest_seq(space:)
        Success(Sync::SpaceSequence.find_by(space_id: space.id)&.last_seq || 0)
      end

      def verify_latest_seq_unchanged(space:, expected_seq:)
        current = Sync::SpaceSequence.find_by(space_id: space.id)&.last_seq || 0
        return Failure(snapshot_changed: true, message: "Space changed during bootstrap") if current != expected_seq

        Success(current)
      end

      def load_accounts(space:)
        result = Transactions::Operations::Accounts::ShowAccounts.new.call(
          space_id: space.id.to_s,
        )
        return result if result.failure?

        Success(result.value!)
      end

      def load_categories(space:)
        result = Transactions::Operations::Categories::ShowAllCategories.new.call(
          space_id: space.id.to_s,
        )
        return result if result.failure?

        Success(result.value!)
      end

      def load_transactions(space:)
        query = Transactions::Queries::FilteredCombined.call(
          params: {
            space_code: space.code,
            start_date: BOOTSTRAP_START_DATE,
            end_date: BOOTSTRAP_END_DATE,
            paginate: false,
          },
        )
        return query if query.failure?

        Success(
          Transactions::Serializers::FilteredCombinedSerializer.render_as_hash(
            query.value!,
          ),
        )
      end

      def load_monthly_summaries(space:)
        result = MonthlyFinancialSummaries::Operations::ListForSpace.new.call(
          space_id: space.id.to_s,
          persist_stale: true,
        )
        return result if result.failure?

        Success(
          MonthlyFinancialSummaries::Serializers::MonthlyFinancialSummarySerializer.render_as_hash(
            result.value!,
          ),
        )
      end

      def load_loans(space:)
        records = space.loans
          .includes(:entity, :account, :loan_payments, { files_attachments: :blob })
          .order(date: :desc, created_at: :desc)

        Success(
          Loans::Serializers::LoanSerializer.render_as_hash(records),
        )
      end

      def load_budgets_by_month(space:, transactions:)
        ranges = month_ranges_for_budgets(transactions:)
        reports = {}

        ranges.each do |range|
          result = Budgets::Operations::PrepareMonthlyReport.new.call(
            space_code: space.code,
            start_date: range[:start_date],
            end_date: range[:end_date],
          )
          next if result.failure?

          key = "#{range[:start_date]}|#{range[:end_date]}"
          reports[key] = result.value!
        end

        Success(reports)
      end

      def serialize_space(space:, current_user:)
        Success(
          Spaces::Serializers::SpaceSerializer.render_as_hash(
            space,
            current_user:,
          ),
        )
      end

      def month_ranges_for_budgets(transactions:)
        earliest = earliest_transaction_date(transactions:) || Date.current
        month_ranges_inclusive(earliest.beginning_of_month, Date.current)
      end

      def earliest_transaction_date(transactions:)
        transactions.filter_map do |row|
          raw = row[:date] || row["date"]
          next if raw.blank?

          Time.zone.parse(raw.to_s).to_date
        rescue ArgumentError
          nil
        end.min
      end

      def month_ranges_inclusive(from_date, to_date)
        ranges = []
        current = from_date.beginning_of_month
        last = to_date.beginning_of_month

        while current <= last
          ranges << {
            start_date: current,
            end_date: current.end_of_month,
          }
          current = current.next_month
        end

        ranges
      end
    end
  end
end
