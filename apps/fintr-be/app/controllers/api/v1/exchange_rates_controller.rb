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
    end
  end
end
