# frozen_string_literal: true

require "json"
require "net/http"
require "uri"
require_relative "error"

module Integrations
  module Revenuecat
    # RevenueCat REST API v2.
    # https://www.revenuecat.com/docs/api-v2
    class Client
      BASE_URL = "https://api.revenuecat.com".freeze

      def initialize(api_key: nil, project_id: nil)
        @api_key = api_key || ENV["REVENUECAT_API_SECRET"].to_s
        @project_id = project_id || ENV["REVENUECAT_PROJECT_ID"].to_s
        if @api_key.blank? || @project_id.blank?
          raise NotConfigured.new(
            message: "Set REVENUECAT_API_SECRET and REVENUECAT_PROJECT_ID",
          )
        end
      end

      # GET /v2/projects/{project_id}/customers/{customer_id}
      # Permission: customer_information:customers:read
      def get_customer(customer_id:)
        get(
          "/v2/projects/#{encode(project_id)}/customers/#{encode(customer_id)}",
        )
      end

      def get(path)
        uri = URI(path.start_with?("http") ? path : "#{BASE_URL}#{path}")
        request = Net::HTTP::Get.new(uri)
        add_headers(request)
        parse_response(make_request(uri, request))
      end

      private

      attr_reader :api_key, :project_id

      def encode(value)
        ERB::Util.url_encode(value.to_s)
      end

      def add_headers(request)
        request["Authorization"] = "Bearer #{api_key}"
        request["Accept"] = "application/json"
        request["Content-Type"] = "application/json"
      end

      def make_request(uri, request)
        http = Net::HTTP.new(uri.hostname, uri.port)
        http.use_ssl = uri.scheme == "https"
        http.read_timeout = 30
        http.open_timeout = 10
        http.request(request)
      rescue StandardError => e
        raise Error.new(
          message: "RevenueCat API request failed: #{e.message}",
          status: nil,
          retryable: true,
        )
      end

      def parse_response(response)
        body = response.body.present? ? JSON.parse(response.body) : {}

        case response
        when Net::HTTPSuccess
          body
        when Net::HTTPNotFound
          raise NotFound.new(body:)
        when Net::HTTPTooManyRequests
          raise Error.new(
            message: body["message"].presence || "Rate limit exceeded",
            status: 429,
            body:,
            retryable: true,
            backoff_ms: body["backoff_ms"],
          )
        else
          raise Error.new(
            message: body["message"].presence || "RevenueCat API error",
            status: response.code.to_i,
            body:,
            retryable: response.code.to_i >= 500,
          )
        end
      end
    end
  end
end
