# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      module Data
        # Retrieves structured financial data using Dry::Operation
        class RetrieveStructuredData < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              required(:space_id).value(:string)
              required(:analysis).value(:hash)
            end
          end

          def initialize(query_builder: nil)
            super()
            @query_builder = query_builder || Ai::Rag::QueryBuilder.new
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            Success(contract.to_h)
          end

          def call(params)
            params = step validate(params:)

            data = case params[:analysis][:query_type]
            when "spending_analysis"
              step retrieve_spending_data(params:)
            when "income_analysis"
              step retrieve_income_data(params:)
            when "trend_analysis"
              step retrieve_trend_data(params:)
            when "transaction_search"
              step retrieve_transactions(params:)
            else
              step retrieve_general_data(params:)
            end

            data
          end

          private

          def retrieve_spending_data(params:)
            query = @query_builder.build(params[:analysis])

            if params[:analysis][:aggregations]&.dig(:group_by)&.any?
              retrieve_aggregated(query, params[:analysis])
            else
              retrieve_transactions_list(query, params[:analysis])
            end
          end

          def retrieve_income_data(params:)
            income_analysis = params[:analysis].dup
            income_analysis[:filters] = income_analysis[:filters]&.merge(
              transaction_type: ["income"]
            ) || { transaction_type: ["income"] }

            retrieve_spending_data(params: params.merge(analysis: income_analysis))
          end

          def retrieve_trend_data(params:)
            query = @query_builder.build(params[:analysis])
            time_grouping = determine_time_grouping(params[:analysis][:time_range])

            trend_data = case time_grouping
            when :month
              query.group_by_month(:date, series: false).sum(:amount_cents)
            when :week
              query.group_by_week(:date, series: false).sum(:amount_cents)
            else
              query.group_by_day(:date, series: false).sum(:amount_cents)
            end

            formatted = trend_data.map do |period, amount_cents|
              {
                period: period.to_s,
                amount: Money.new(amount_cents).format,
                amount_cents: amount_cents
              }
            end

            Success(formatted)
          end

          def retrieve_transactions(params:)
            query = @query_builder.build(params[:analysis])

            transactions = query
              .order(amount_cents: params[:analysis][:sorting]&.dig(:direction) || :desc)
              .limit(params[:analysis][:limit] || 10)
              .map { |t| serialize_transaction(t) }

            Success(transactions)
          end

          def retrieve_general_data(params:)
            retrieve_transactions(params:)
          end

          def retrieve_aggregated(query, analysis)
            # Use existing operation for complex aggregations
            legacy_op = Ai::Operations::Rag::Data::RetrieveStructuredData.new
            result = legacy_op.call(
              space_id: analysis[:space_id],
              data_requirements: analysis,
            )

            return result if result.success?
            Failure(result.failure)
          end

          def retrieve_transactions_list(query, analysis)
            transactions = query
              .limit(analysis[:limit] || 10)
              .map { |t| serialize_transaction(t) }

            Success(transactions)
          end

          def determine_time_grouping(time_range)
            case time_range&.dig(:period)
            when "this_year", "last_year"
              :month
            when "this_month", "last_month"
              :day
            else
              :day
            end
          end

          def serialize_transaction(transaction)
            {
              id: transaction.id,
              amount: transaction.amount.format,
              amount_cents: transaction.amount_cents,
              description: transaction.description,
              category: transaction.category&.name,
              account: transaction.account&.name,
              date: transaction.created_at.strftime("%Y-%m-%d"),
              type: transaction.type.demodulize.downcase
            }
          end
        end
      end
    end
  end
end
