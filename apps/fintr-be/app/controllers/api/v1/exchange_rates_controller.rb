# frozen_string_literal: true

module Api
  module V1
    class ExchangeRatesController < ApiController
      # Return full-precision rates; frontend displays with 3 decimals but stores/calculates with full precision.

      # GET /api/v1/exchange_rates/current
      # Returns current rate (cache or API); labeled "auto" in frontend
      def current
        date = params[:date].presence && begin
          Date.parse(params[:date])
        rescue ArgumentError
          nil
        end
        date ||= Date.current

        result = ::ExchangeRates::Operations::FetchRate.new.call(
          from_currency: params[:from_currency],
          to_currency: params[:to_currency],
          space_id: current_space.id,
          date: date
        )

        return render_unprocessable_content(details: result.failure) unless result.success?

        rate_data = result.value!
        render_success(
          data: {
            rate: rate_data[:rate],
            from_currency: rate_data[:from_currency],
            to_currency: rate_data[:to_currency],
            source: "auto",
            timestamp: rate_data[:timestamp]
          }
        )
      end

      # GET /api/v1/exchange_rates/recent
      # Returns last 3 rates used for this space and pair
      def recent
        result = ::ExchangeRates::Operations::GetRecentRates.new.call(
          from_currency: params[:from_currency],
          to_currency: params[:to_currency],
          space_id: current_space.id
        )

        return render_unprocessable_content(details: result.failure) unless result.success?

        render_success(
          data: {
            rates: result.value!,
            source: "last_prices"
          }
        )
      end

      # POST /api/v1/exchange_rates/batch
      # Returns current rates for many pair/date combinations in one response.
      def batch
        requests = Array(params[:requests]).map do |row|
          row = row.to_unsafe_h if row.respond_to?(:to_unsafe_h)
          row = row.to_h if row.respond_to?(:to_h) && !row.is_a?(Hash)
          row.symbolize_keys.slice(:from_currency, :to_currency, :date)
        end

        result = ::ExchangeRates::Operations::FetchBatchRates.new.call(
          requests: requests,
          space_id: current_space.id
        )

        return render_unprocessable_content(details: result.failure) unless result.success?

        payload = result.value!
        render_success(
          data: {
            rates: payload[:rates],
            errors: payload[:errors]
          }
        )
      end
    end
  end
end
