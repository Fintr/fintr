# frozen_string_literal: true

require "net/http"
require "uri"
require "json"

module Integrations
  module Marketing
    module Brevo
      class Client
        BASE_URL = "https://api.brevo.com/v3".freeze

        def initialize(api_key: nil, base_url: BASE_URL)
          @api_key = api_key || ENV["BREVO_API_KEY"]
          @base_url = base_url

          raise ArgumentError, "Brevo API key is required" if @api_key.blank?
        end

        def upsert_contact_to_list(email:, list_name:, full_name: nil)
          list_id = find_list_id_by_name(list_name:)
          raise "Brevo list not found: #{list_name}" if list_id.blank?

          extracted_names = ContactNameExtractor.call(value: full_name)
          attributes = build_contact_attributes(extracted_names:)

          post(
            "/contacts",
            {
              email:,
              listIds: [
                list_id
              ],
              updateEnabled: true,
              attributes:
            }.compact
          )
        end

        private

        def find_list_id_by_name(list_name:)
          body = get("/contacts/lists")
          lists = body.fetch("lists", [])
          list = lists.find { |current_list| current_list["name"] == list_name }
          list&.fetch("id", nil)
        end

        def get(path)
          uri = URI("#{@base_url}#{path}")
          request = Net::HTTP::Get.new(uri)
          add_headers(request)
          response = make_request(uri:, request:)
          parse_response(response:)
        end

        def post(path, payload)
          uri = URI("#{@base_url}#{path}")
          request = Net::HTTP::Post.new(uri)
          add_headers(request)
          request.body = payload.to_json
          response = make_request(uri:, request:)
          parse_response(response:)
        end

        def add_headers(request)
          request["api-key"] = @api_key
          request["Content-Type"] = "application/json"
          request["Accept"] = "application/json"
        end

        def make_request(uri:, request:)
          http = Net::HTTP.new(uri.hostname, uri.port)
          http.use_ssl = true
          http.read_timeout = 30
          http.open_timeout = 10
          http.request(request)
        end

        def parse_response(response:)
          body = response.body.presence ? JSON.parse(response.body) : {}
          return body if response.is_a?(Net::HTTPSuccess) || response.code.to_i == 201

          raise "Brevo API request failed (#{response.code}): #{body}"
        end

        def build_contact_attributes(extracted_names:)
          first_name = extracted_names[:first_name]
          last_name = extracted_names[:last_name]

          {
            "FIRSTNAME" => first_name,
            "LASTNAME" => last_name
          }.compact.presence
        end
      end
    end
  end
end
