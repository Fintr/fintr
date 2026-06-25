# frozen_string_literal: true

module ExchangeRates
  module Operations
    class FetchRate < Dry::Operation
      BASE_CURRENCY = ExchangeRates::ApiExchangeRate::BASE_CURRENCY

      class Contract < Dry::Validation::Contract
        params do
          required(:from_currency).value(:string)
          required(:to_currency).value(:string)
          optional(:date).value(:date)
          optional(:space_id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        early = step check_same_currency(params)
        return early if early[:same_currency]

        rate_data = step resolve_rate(params)
        step build_rate_response(params, rate_data)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        merged = result.to_h
        merged[:from_currency] = merged[:from_currency].to_s.upcase
        merged[:to_currency] = merged[:to_currency].to_s.upcase
        Success(merged)
      end

      def check_same_currency(params)
        if params[:from_currency] == params[:to_currency]
          return Success(
            rate: 1.0,
            source: "same_currency",
            from_currency: params[:from_currency],
            to_currency: params[:to_currency],
            timestamp: Time.current,
            same_currency: true
          )
        end
        Success(same_currency: false)
      end

      def resolve_rate(params)
        from_c = params[:from_currency]
        to_c = params[:to_currency]
        date = params[:date] || Date.current
        lookup_params = {
          from_currency: from_c,
          to_currency: to_c,
          date: date
        }

        compute_rate_data(
          from_c:,
          to_c:,
          date:,
          lookup_params:
        )
      end

      def compute_rate_data(from_c:, to_c:, date:, lookup_params:)
        rate_data = step GetCachedApiRate.new.call(lookup_params)
        return Success(rate_data) if rate_data.present?

        if usd_only_pair?(from_c:, to_c:)
          return Success(
            rate: 1.0,
            source: "api",
            from_currency: from_c,
            to_currency: to_c,
            timestamp: Time.current
          )
        end

        missing = ExchangeRates::ApiExchangeRate.missing_base_targets_for(
          from: from_c,
          to: to_c,
          date: date
        )

        if missing.empty?
          return resolve_from_existing_base_rates(
            lookup_params:,
            from_c:,
            to_c:
          )
        end

        fetch_and_persist_missing(
          missing: missing,
          date: date
        )

        rate_data = step GetCachedApiRate.new.call(lookup_params)
        return Success(rate_data) if rate_data.present?

        latest = latest_cached_rate_response(from_c:, to_c:)
        return Success(latest) if latest.present?

        Failure(
          message: unsupported_currency_message(from_currency: from_c, to_currency: to_c)
        )
      end

      def usd_only_pair?(from_c:, to_c:)
        ExchangeRates::ApiExchangeRate.base_targets_for(from: from_c, to: to_c).blank?
      end

      def resolve_from_existing_base_rates(lookup_params:, from_c:, to_c:)
        rate_data = step GetCachedApiRate.new.call(lookup_params)
        return Success(rate_data) if rate_data.present?

        latest = latest_cached_rate_response(from_c:, to_c:)
        return Success(latest) if latest.present?

        Failure(
          message: unsupported_currency_message(from_currency: from_c, to_currency: to_c)
        )
      end

      def fetch_and_persist_missing(missing:, date:)
        api_result = FetchRatesFromApi.new.call(
          base_currency: BASE_CURRENCY,
          date: date,
          target_currencies: missing
        )
        return Success(false) unless api_result.success?

        rates = api_result.value!
        return Success(false) if rates.blank?

        needed_rates = missing.each_with_object({}) do |target, memo|
          key = target.to_s.upcase
          memo[key] = rates[key] if rates.key?(key)
        end
        if needed_rates.present?
          persist_result = PersistApiRates.new.call(rates: needed_rates, date: date)
          return Success(false) unless persist_result.success?
        end

        ExchangeRates::PersistDailyApiRatesJob.enqueue_for_date(
          date:,
          rates:
        )

        Success(true)
      rescue StandardError => e
        Rails.logger.warn(
          "[ExchangeRates::Operations::FetchRate] API fetch failed for #{date}: #{e.message}"
        )
        Success(false)
      end

      def latest_cached_rate_response(from_c:, to_c:)
        latest_rate = ExchangeRates::ApiExchangeRate.get_rate_latest(from: from_c, to: to_c)
        return nil unless latest_rate.present?

        {
          rate: latest_rate,
          source: "recent_cached",
          from_currency: from_c,
          to_currency: to_c,
          timestamp: Time.current
        }
      end

      def unsupported_currency_message(from_currency:, to_currency:)
        "Exchange rate not available for #{from_currency}. " \
          "Enter the amount in #{to_currency} or provide a manual exchange rate."
      end

      def build_rate_response(params, rate)
        if rate.blank?
          return Failure(
            message: unsupported_currency_message(
              from_currency: params[:from_currency],
              to_currency: params[:to_currency]
            )
          )
        end

        Success(rate)
      end
    end
  end
end
