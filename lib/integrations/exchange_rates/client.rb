# frozen_string_literal: true

require "net/http"
require "json"

module Integrations
  module ExchangeRates
    class Client
      # fawazahmed0 currency-api (jsDelivr CDN)
      # Latest:    .../currency-api@latest/v1/currencies/usd.json
      # Historical: .../currency-api@YYYY-MM-DD/v1/currencies/usd.json
      # Response: { "date" => "...", "usd" => { "aed" => 3.6725, "php" => 57.9, ... } }
      # Supports many currencies including AED. Single base (USD) in URL.
      BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@"
      BASE_CURRENCY = "USD"

      # Fetch all rates from base currency for a date (e.g. USD → PHP, AED, ...).
      # Returns hash: { "PHP" => rate, "AED" => rate, ... } with uppercase keys.
      # If the requested date fails (e.g. no package version), retries with "latest".
      def self.fetch_rates_from_base(base: BASE_CURRENCY, date: Date.current)
        return {} unless base.to_s.upcase == BASE_CURRENCY

        response = make_request(build_uri(date: date))
        if !response.is_a?(Net::HTTPSuccess) && date != Date.current
          Rails.logger.warn(
            "currency-api: no data for date #{date}, retrying with latest"
          )
          response = make_request(build_uri(date: Date.current))
        end
        return {} unless response.is_a?(Net::HTTPSuccess)

        data = JSON.parse(response.body)
        rates = data["usd"] || {}
        normalize_rates_hash(rates)
      rescue StandardError => e
        Rails.logger.error("currency-api fetch_rates_from_base failed: #{e.message}")
        {}
      end

      # Fetch rate for a single target (USD → target_currency) for a date.
      def self.fetch_rate_for_target(target_currency:, base: BASE_CURRENCY, date: Date.current)
        return 1.0 if target_currency.to_s.upcase == base.to_s.upcase

        fetch_rates_from_base(base: base, date: date).fetch(target_currency.to_s.upcase)
      end

      # Fetch rates for multiple targets in one request (USD → to_currencies).
      # API returns all rates; we slice to requested targets and normalize keys.
      def self.fetch_rates_for_targets(to_currencies:, base: BASE_CURRENCY, date: Date.current)
        to_list = Array(to_currencies).uniq.compact.reject(&:blank?)
        return {} if to_list.blank?

        all_rates = fetch_rates_from_base(base: base, date: date)
        to_list.each_with_object({}) do |code, out|
          key = code.to_s.upcase
          out[key] = all_rates[key] if all_rates.key?(key)
        end
      end

      def self.build_uri(date: Date.current)
        date_segment = (date == Date.current) ? "latest" : date.to_s
        URI("#{BASE_URL}#{date_segment}/v1/currencies/usd.json")
      end

      # API returns lowercase keys (e.g. "aed", "php"). Normalize to uppercase for app.
      def self.normalize_rates_hash(rates)
        rates.transform_keys { |k| k.to_s.upcase }
      end

      MAX_REDIRECTS = 5

      def self.make_request(uri, redirect_limit: MAX_REDIRECTS)
        raise ArgumentError, "HTTP redirect too deep" if redirect_limit <= 0

        http = Net::HTTP.new(uri.hostname, uri.port)
        http.use_ssl = (uri.scheme == "https")
        http.read_timeout = 10
        http.open_timeout = 5
        response = http.get(uri)

        case response
        when Net::HTTPSuccess
          response
        when Net::HTTPRedirection
          location = response["location"]
          next_uri = location.start_with?("http") ? URI(location) : URI.join(uri, location)
          Rails.logger.warn("currency-api: following redirect to #{next_uri}") if Rails.logger
          make_request(next_uri, redirect_limit: redirect_limit - 1)
        else
          Rails.logger.warn(
            "currency-api: HTTP #{response.code} for #{uri}"
          ) if Rails.logger
          response
        end
      end
    end
  end
end
