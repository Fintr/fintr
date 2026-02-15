# frozen_string_literal: true

module Ai
  module Rag
    # Retrieves structured data from database (Single Responsibility)
    class DataRetriever
      def initialize(query_builder: nil)
        @query_builder = query_builder || QueryBuilder.new
      end

      # Retrieve data based on analysis requirements
      # @param analysis [Hash, AnalysisResult]
      # @return [Array<Hash>]
      def retrieve(analysis)
        case analysis.query_type
        when 'spending_analysis'
          retrieve_spending_data(analysis)
        when 'income_analysis'
          retrieve_income_data(analysis)
        when 'trend_analysis'
          retrieve_trend_data(analysis)
        when 'transaction_search'
          retrieve_transactions(analysis)
        else
          retrieve_general_data(analysis)
        end
      rescue StandardError => e
        Rails.logger.error "[DataRetriever] Error: #{e.message}"
        []
      end

      private

      def retrieve_spending_data(analysis)
        query = @query_builder.for_spending(analysis)

        if analysis.aggregations&.dig(:group_by)&.any?
          apply_grouping(query, analysis)
        else
          execute_and_format(query, analysis)
        end
      end

      def retrieve_income_data(analysis)
        analysis_with_type = analysis.dup
        analysis_with_type.filters ||= {}
        analysis_with_type.filters[:transaction_type] = ['income']

        retrieve_spending_data(analysis_with_type)
      end

      def retrieve_trend_data(analysis)
        query = @query_builder.for_trends(analysis)
        trend_data = execute_trend_query(query, analysis)

        format_trend_data(trend_data)
      end

      def retrieve_transactions(analysis)
        query = @query_builder.for_transactions(analysis)
        transactions = query.limit(analysis.limit || 10)

        transactions.map { |t| serialize_transaction(t) }
      end

      def retrieve_general_data(analysis)
        retrieve_transactions(analysis)
      end

      def apply_grouping(query, analysis)
        group_fields = analysis.aggregations[:group_by]
        metrics = analysis.aggregations[:metrics] || ['sum']
        metrics = (metrics + ['count']).uniq

        grouped = group_query(query, group_fields)
        calculated = calculate_metrics(grouped, metrics)

        format_grouped_data(
          calculated,
          group_fields,
          analysis,
        )
      end

      def group_query(query, group_fields)
        group_fields.each do |field|
          case field
          when 'category'
            query = query.joins(:category)
                           .group('transactions_categories.name')
          when 'account'
            query = query.joins(:account)
                           .group('spaces_accounts.name')
          when 'description'
            query = query.group(:description)
          when 'month'
            query = query.group_by_month(:date, series: false)
          when 'week'
            query = query.group_by_week(:date, series: false)
          when 'day'
            query = query.group_by_day(:date, series: false)
          end
        end

        query
      end

      def calculate_metrics(query, metrics)
        result = {}

        metrics.each do |metric|
          case metric
          when 'sum'
            result[:sum] = query.sum(:amount_cents)
          when 'count'
            result[:count] = query.count
          when 'average'
            result[:average] = query.average(:amount_cents)
          when 'max'
            result[:max] = query.maximum(:amount_cents)
          when 'min'
            result[:min] = query.minimum(:amount_cents)
          end
        end

        result
      end

      def format_grouped_data(result_data, group_fields, analysis)
        primary_data = result_data[:sum] || result_data[:count] || result_data.values.first

        formatted = primary_data.map do |group_key, _|
          item = {
            group: group_key.is_a?(Array) ? group_key : [group_key],
            group_fields: group_fields,
          }

          result_data.each do |metric, data|
            value = data[group_key] || 0

            case metric
            when :sum, :max, :min, :average
              item[metric] = {
                amount: Money.new(value).format,
                amount_cents: value,
              }
            when :count
              item[metric] = value
            end
          end

          item
        end

        sort_and_limit(formatted, analysis)
      end

      def sort_and_limit(data, analysis)
        sort_field = analysis.sorting&.dig(:field) || 'amount'
        direction = analysis.sorting&.dig(:direction) || 'desc'

        sorted = data.sort_by do |item|
          value = item.dig(:sum, :amount_cents) || item[:count] || 0
          direction.to_s == 'desc' ? -value : value
        end

        limit = analysis.limit || 10
        sorted.first(limit)
      end

      def execute_and_format(query, _analysis)
        query.limit(10).map { |t| serialize_transaction(t) }
      end

      def execute_trend_query(query, analysis)
        time_grouping = determine_time_grouping(analysis.time_range)

        case time_grouping
        when :month
          query.group_by_month(:date, series: false)
               .sum(:amount_cents)
        when :week
          query.group_by_week(:date, series: false)
               .sum(:amount_cents)
        when :day
          query.group_by_day(:date, series: false)
               .sum(:amount_cents)
        else
          query.group_by_day(:date, series: false)
               .sum(:amount_cents)
        end
      end

      def determine_time_grouping(time_range)
        period = time_range&.dig(:period)

        case period
        when 'this_year', 'last_year'
          :month
        when 'this_month', 'last_month'
          :day
        else
          :day
        end
      end

      def format_trend_data(trend_data)
        trend_data.map do |period, amount_cents|
          {
            period: period.to_s,
            amount: Money.new(amount_cents).format,
            amount_cents: amount_cents,
          }
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
          date: transaction.date.to_s,
          type: transaction.type&.demodulize&.downcase,
        }
      end
    end
  end
end
