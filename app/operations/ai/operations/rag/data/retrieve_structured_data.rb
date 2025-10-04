# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      module Data
        class RetrieveStructuredData < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:data_requirements).value(:hash)
          end
        end

        def validate(params)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          validated_params = step validate(params)
          data = step retrieve_structured_data(params: validated_params)
          formatted_data = step format_data_for_ai(data:, requirements: validated_params[:data_requirements])
          formatted_data
        end

        private

        def retrieve_structured_data(params:)
          space_id = params[:space_id]
          requirements = params[:data_requirements]

          case requirements[:query_type]
          when "spending_analysis"
            retrieve_spending_data(space_id:, requirements:)
          when "income_analysis"
            retrieve_income_data(space_id:, requirements:)
          when "trend_analysis"
            retrieve_trend_data(space_id:, requirements:)
          when "transaction_search"
            retrieve_transaction_data(space_id:, requirements:)
          else
            retrieve_general_financial_data(space_id:, requirements:)
          end
        end

        def retrieve_spending_data(space_id:, requirements:)
          query = step build_transaction_query(space_id:, requirements:)

          # Apply aggregation based on requirements
          if requirements.dig(:aggregations, :group_by)&.any?
            group_fields = requirements[:aggregations][:group_by]
            metrics = requirements[:aggregations][:metrics] || ["sum"]

            # Always include count for grouped data to show transaction counts
            metrics = (metrics + ["count"]).uniq

            grouped_data = step apply_grouping(query, group_fields, metrics)
            Success(grouped_data)
          else
            transactions = step apply_sorting_and_limit(query, requirements)
            serialized_transactions = transactions.map do |transaction|
              step serialize_transaction(transaction)
            end
            Success(serialized_transactions)
          end
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to retrieve spending data: #{e.message}")
        end

        def retrieve_income_data(space_id:, requirements:)
          # Similar to spending but filter for income transactions
          income_requirements = requirements.dup
          income_requirements[:filters] = (income_requirements[:filters] || {}).merge(
            transaction_type: ["income"]
          )

          retrieve_spending_data(space_id:, requirements: income_requirements)
        end

        def retrieve_trend_data(space_id:, requirements:)
          query = step build_transaction_query(space_id:, requirements:)

          # Group by time periods for trend analysis using Groupdate
          time_grouping = step determine_time_grouping(requirements[:time_range])
          trend_data = case time_grouping
          when :month
                         query.group_by_month(:date, series: false).sum(:amount_cents)
          when :week
                         query.group_by_week(:date, series: false).sum(:amount_cents)
          when :day
                         query.group_by_day(:date, series: false).sum(:amount_cents)
          else
                         query.group_by_day(:date, series: false).sum(:amount_cents)
          end

          formatted_trends = trend_data.map do |period, amount_cents|
            {
              period: period.to_s,
              amount: Money.new(amount_cents).format,
              amount_cents: amount_cents
            }
          end

          Success(formatted_trends)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to retrieve trend data: #{e.message}")
        end

        def retrieve_transaction_data(space_id:, requirements:)
          query = step build_transaction_query(space_id:, requirements:)
          transactions = step apply_sorting_and_limit(query, requirements)

          serialized_transactions = transactions.map do |transaction|
            result = serialize_transaction(transaction)
            result.success? ? result.value! : result
          end
          Success(serialized_transactions)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to retrieve transaction data: #{e.message}")
        end

        def retrieve_general_financial_data(space_id:, requirements:)
          # Fallback to general transaction data
          step retrieve_transaction_data(space_id:, requirements:)
        end

        def build_transaction_query(space_id:, requirements:)
          space = Spaces::Space.find(space_id)
          query = space.transactions.includes(:category, :account)

          # Apply filters
          query = remove_initial_balance(query)
          query = apply_transaction_type_filter(query, requirements[:filters])
          query = apply_category_filter(query, requirements[:filters])
          query = apply_account_filter(query, requirements[:filters])
          query = apply_description_filter(query, requirements[:filters])
          query = apply_amount_filter(query, requirements[:filters])
          query = apply_time_range_filter(query, requirements[:time_range])

          Success(query)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to build transaction query: #{e.message}")
        end

        def remove_initial_balance(query)
          query.where.not(transactions_categories: { name: "Initial Balance" })
        end

        def apply_transaction_type_filter(query, filters)
          return query unless filters[:transaction_type]&.any?

          types = filters[:transaction_type].map do |type|
            case type
            when "expense"
              "Transactions::Expense"
            when "income"
              "Transactions::Income"
            when "transfer"
              "Transactions::Transfer"
            else
              type
            end
          end

          query.where(type: types)
        end

        def apply_category_filter(query, filters)
          return query unless filters[:categories]&.any?

          query.joins(:category).where(
            "transactions_categories.name ILIKE ANY(ARRAY[?])",
            filters[:categories].map { |cat| "%#{cat}%" }
          )
        end

        def apply_account_filter(query, filters)
          return query unless filters[:accounts]&.any?

          query.joins(:account).where(
            "spaces_accounts.name ILIKE ANY(ARRAY[?])",
            filters[:accounts].map { |acc| "%#{acc}%" }
          )
        end

        def apply_description_filter(query, filters)
          return query unless filters[:descriptions]&.any?

          query.where(
            "description ILIKE ANY(ARRAY[?])",
            filters[:descriptions].map { |desc| "%#{desc}%" }
          )
        end

        def apply_amount_filter(query, filters)
          amount_range = filters[:amount_range]
          return query unless amount_range.is_a?(Hash)

          query = query.where("amount_cents >= ?", amount_range[:min] * 100) if amount_range[:min]
          query = query.where("amount_cents <= ?", amount_range[:max] * 100) if amount_range[:max]

          query
        end

        def apply_time_range_filter(query, time_range)
          return query unless time_range.is_a?(Hash)

          case time_range[:period]
          when "this_month"
            query.where(date: Date.current.beginning_of_month..Date.current.end_of_month)
          when "last_month"
            last_month = Date.current.last_month
            query.where(date: last_month.beginning_of_month..last_month.end_of_month)
          when "this_week"
            query.where(date: Date.current.beginning_of_week..Date.current.end_of_week)
          when "last_week"
            last_week = Date.current.last_week
            query.where(date: last_week.beginning_of_week..last_week.end_of_week)
          when "this_year"
            query.where(date: Date.current.beginning_of_year..Date.current.end_of_year)
          when "last_year"
            last_year = Date.current.last_year
            query.where(date: last_year.beginning_of_year..last_year.end_of_year)
          when "custom"
            start_date = Date.parse(time_range[:start_date]) if time_range[:start_date]
            end_date = Date.parse(time_range[:end_date]).end_of_day if time_range[:end_date]

            if start_date && end_date
              query.where(date: start_date..end_date)
            elsif start_date
              query.where("date >= ?", start_date)
            elsif end_date
              query.where("date <= ?", end_date)
            else
              query
            end
          else
            query
          end
        rescue Date::Error
          query
        end

        def apply_grouping(query, group_fields, metrics)
          # Build grouping based on requested fields
          grouped_query = query

          group_fields.each do |field|
            case field
            when "category"
              grouped_query = grouped_query.joins(:category).group("transactions_categories.name")
            when "account"
              grouped_query = grouped_query.joins(:account).group("accounts.name")
            when "description"
              grouped_query = grouped_query.group(:description)
            when "month"
              # Use Groupdate gem for time-based grouping
              grouped_query = grouped_query.group_by_month(:created_at, series: false)
            when "week"
              # Use Groupdate gem for time-based grouping
              grouped_query = grouped_query.group_by_week(:created_at, series: false)
            when "day"
              # Use Groupdate gem for time-based grouping
              grouped_query = grouped_query.group_by_day(:created_at, series: false)
            end
          end

          # Apply metrics
          result_data = {}
          metrics.each do |metric|
            case metric
            when "sum"
              result_data[:sum] = grouped_query.sum(:amount_cents)
            when "count"
              result_data[:count] = grouped_query.count
            when "average"
              result_data[:average] = grouped_query.average(:amount_cents)
            when "max"
              result_data[:max] = grouped_query.maximum(:amount_cents)
            when "min"
              result_data[:min] = grouped_query.minimum(:amount_cents)
            end
          end

          # Format the grouped data
          format_grouped_data(result_data, group_fields)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to apply grouping: #{e.message}")
        end

        def format_grouped_data(result_data, group_fields)
          return Success([]) if result_data.empty?

          # Use the sum data as the primary dataset for grouping keys
          primary_data = result_data[:sum] || result_data[:count] || result_data.values.first

          formatted_data = primary_data.map do |group_key, value|
            item = {
              group: group_key.is_a?(Array) ? group_key : [group_key],
              group_fields: group_fields
            }

            result_data.each do |metric, data|
              case metric
              when :sum, :max, :min, :average
                amount_value = data[group_key] || 0
                item[metric] = {
                  amount: Money.new(amount_value).format,
                  amount_cents: amount_value
                }
              when :count
                # Make sure count is always available and correct
                count_value = data[group_key] || 0
                item[metric] = count_value
              end
            end

            item
          end

          Success(formatted_data)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to format grouped data: #{e.message}")
        end

        def apply_sorting_and_limit(query, requirements)
          sorting = requirements[:sorting] || {}
          limit = requirements[:limit] || 10

          case sorting[:field]
          when "amount"
            query = query.order(amount_cents: sorting[:direction] || :desc)
          when "date"
            query = query.order(created_at: sorting[:direction] || :desc)
          else
            query = query.order(created_at: :desc)
          end

          Success(query.limit(limit))
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to apply sorting and limit: #{e.message}")
        end

        def determine_time_grouping(time_range)
          grouping = case time_range[:period]
          when "this_year", "last_year"
            :month
          when "this_month", "last_month"
            :day
          else
            :day
          end

          Success(grouping)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to determine time grouping: #{e.message}")
        end

        def serialize_transaction(transaction)
          serialized = {
            id: transaction.id,
            amount: transaction.amount.format,
            amount_cents: transaction.amount_cents,
            description: transaction.description,
            category: transaction.category&.name,
            account: transaction.account&.name,
            date: transaction.created_at.strftime("%Y-%m-%d"),
            type: transaction.type.demodulize.downcase
          }

          Success(serialized)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to serialize transaction: #{e.message}")
        end

        def format_data_for_ai(data:, requirements:)
          data_summary_result = step build_data_summary(data, requirements)
          
          formatted = {
            query_type: requirements[:query_type],
            data_summary: data_summary_result,
            raw_data: data,
            metadata: {
              total_records: data.is_a?(Array) ? data.length : 1,
              aggregation_applied: requirements.dig(:aggregations, :group_by)&.any?,
              time_range: requirements[:time_range],
              filters_applied: requirements[:filters]
            }
          }

          Success(formatted)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to format data for AI: #{e.message}")
        end

        def build_data_summary(data, requirements)
          return Success("No data found") if data.empty?

          summary = case requirements[:query_type]
          when "spending_analysis"
            if data.is_a?(Array) && data.first.is_a?(Hash) && data.first[:sum]
              total = data.sum { |item| item.dig(:sum, :amount_cents) || 0 }
              "Found #{data.length} spending categories with total of #{Money.new(total).format}"
            else
              total = data.sum { |item| item[:amount_cents] || 0 }
              "Found #{data.length} transactions totaling #{Money.new(total).format}"
            end
          when "income_analysis"
            total = data.sum { |item| item.dig(:sum, :amount_cents) || item[:amount_cents] || 0 }
            "Found #{data.length} income entries totaling #{Money.new(total).format}"
          when "trend_analysis"
            "Found trend data across #{data.length} time periods"
          else
            "Retrieved #{data.length} financial records"
          end

          Success(summary)
        rescue StandardError => e
          Failure(data_retrieval_error: "Failed to build data summary: #{e.message}")
        end
        end
      end
    end
  end
end
