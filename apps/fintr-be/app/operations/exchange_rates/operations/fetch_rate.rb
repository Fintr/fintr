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

        Success(result.to_h)
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
        # 1. Try cache for this date
        rate_data = step GetCachedApiRate.new.call(params)
        return Success(rate_data) if rate_data.present?

        # 2. No rate for this date in cache — fetch from external API
        from_c = params[:from_currency]
        to_c = params[:to_currency]
        date = params[:date] || Date.current
        targets = [from_c, to_c].uniq - [BASE_CURRENCY]
        if targets.blank?
          return Success(
            rate: 1.0,
            source: "api",
            from_currency: from_c,
            to_currency: to_c,
            timestamp: Time.current
          )
        end

        # 2a. Try symbol-specific request first
        api_result = FetchRatesFromApi.new.call(
          base_currency: BASE_CURRENCY,
          date: date,
          target_currencies: targets
        )
        if api_result.success?
          rates = api_result.value!
          step PersistApiRates.new.call(rates: rates, date: date)
          cached = step GetCachedApiRate.new.call(params)
          return Success(cached) if cached.present?

          # 2b. Cache still blank (e.g. provider returned only some symbols). Try fetching all rates for date.
          fallback = try_fetch_all_rates_then_latest(params:, date:, from_c:, to_c:)
          return fallback if fallback
        end

        # 2c. Symbol-specific API failed. Try fetching all rates for this date (self-healing).
        all_result = FetchRatesFromApi.new.call(
          base_currency: BASE_CURRENCY,
          date: date,
          target_currencies: nil
        )
        if all_result.success?
          step PersistApiRates.new.call(rates: all_result.value!, date: date)
          cached = step GetCachedApiRate.new.call(params)
          return Success(cached) if cached.present?
        end

        # 2d. Use latest cached rate if any (e.g. for weekends or provider gaps).
        latest_rate = ExchangeRates::ApiExchangeRate.get_rate_latest(from: from_c, to: to_c)
        if latest_rate.present?
          return Success(
            rate: latest_rate,
            source: "recent_cached",
            from_currency: from_c,
            to_currency: to_c,
            timestamp: Time.current
          )
        end

        # 2e. Still no rate (e.g. unsupported currency like AED). Return clear failure.
        Failure(
          message: unsupported_currency_message(from_currency: from_c, to_currency: to_c)
        )
      end

      def try_fetch_all_rates_then_latest(params:, date:, from_c:, to_c:)
        all_result = FetchRatesFromApi.new.call(
          base_currency: BASE_CURRENCY,
          date: date,
          target_currencies: nil
        )
        return nil unless all_result.success?

        persist_result = PersistApiRates.new.call(rates: all_result.value!, date: date)
        return nil unless persist_result.success?

        cached_result = GetCachedApiRate.new.call(params)
        return Success(cached_result.value!) if cached_result.success? && cached_result.value!.present?

        latest_rate = ExchangeRates::ApiExchangeRate.get_rate_latest(from: from_c, to: to_c)
        return nil unless latest_rate.present?

        Success(
          rate: latest_rate,
          source: "recent_cached",
          from_currency: from_c,
          to_currency: to_c,
          timestamp: Time.current
        )
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
