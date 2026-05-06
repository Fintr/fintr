# frozen_string_literal: true

require "net/http"
require "uri"
require "json"
require "base64"
require "securerandom"

module Integrations
  module Payments
    module Xendit
      class Client
        BASE_URL = "https://api.xendit.co".freeze

        def initialize(api_key: nil)
          @api_key = api_key || ENV.fetch("XENDIT_API_KEY")
          raise ArgumentError, "Xendit API key is required" if @api_key.nil? || @api_key.empty?
        end

        # Create or retrieve a customer
        # https://docs.xendit.co/docs/customers
        def create_customer(email:, reference_id: nil, given_names: nil, surname: nil, type: "INDIVIDUAL", metadata: {})
          payload = {
            individual_detail: {
              given_names: given_names,
              surname: surname
            },
            reference_id: reference_id || "cust-#{SecureRandom.uuid}",
            email: email,
            type: type,
            metadata: metadata
          }.compact

          post("/customers", payload)
        end

        # Create a subscription plan
        # https://docs.xendit.co/docs/fixed-amount-subscriptions
        # https://docs.xendit.co/apidocs/create-recurring-plan
        def create_subscription_plan(params:)
          payload = {
            reference_id: params[:reference_id] || "sub-#{SecureRandom.uuid}",
            customer_id: params[:customer_id],
            recurring_action: "PAYMENT",
            currency: params[:currency] || "PHP",
            amount: params[:amount],
            schedule: params[:schedule],
            notification_config: params[:notification_config],
            failed_cycle_action: params[:failed_cycle_action] || "STOP",
            immediate_action_type: params[:immediate_action_type] || "FULL_AMOUNT",
            success_return_url: params[:success_return_url],
            failure_return_url: params[:failure_return_url],
            payment_link_for_failed_attempt: params.fetch(:payment_link_for_failed_attempt, true),
            description: params[:description],
            metadata: params[:metadata]
          }.compact

          post("/recurring/plans", payload)
        end

        # Get subscription plan details
        def get_subscription_plan(plan_id:)
          get("/recurring/plans/#{plan_id}")
        end

        # Update subscription plan
        # https://docs.xendit.co/apidocs/update-recurring-plan
        def update_subscription_plan(plan_id:, params:)
          patch("/recurring/plans/#{plan_id}", params)
        end

        # Update recurring schedule
        # https://docs.xendit.co/apidocs/update-recurring-schedule
        def update_recurring_schedule(plan_id:, schedule_id:, params:)
          patch("/recurring/plans/#{plan_id}/schedules/#{schedule_id}", params)
        end

        # Create payment session for prorated payments
        # https://docs.xendit.co/apidocs/create-session
        # Note: Payment Sessions do NOT accept payment_methods parameter
        def create_payment_session(params:)
          payload = {
            reference_id: params[:reference_id] || "session-#{SecureRandom.uuid}",
            customer_id: params[:customer_id],
            session_type: params[:session_type] || "PAY",
            currency: params[:currency] || "PHP",
            amount: params[:amount],
            country: params[:country] || "PH",
            mode: params[:mode] || "PAYMENT_LINK",
            success_redirect_url: params[:success_redirect_url],
            failure_redirect_url: params[:failure_redirect_url],
            cancel_return_url: params[:cancel_return_url] || params[:failure_redirect_url],
            metadata: params[:metadata] || {}
          }.compact

          post("/sessions", payload)
        end

        # Deactivate subscription plan
        def deactivate_subscription_plan(plan_id:)
          post("/recurring/plans/#{plan_id}/deactivate")
        end

        # Simulate cycle payment (test mode only)
        # https://docs.xendit.co/apidocs/simulate-cycle-payment
        def simulate_cycle_payment(plan_id:, cycle_id:, amount:)
          post("/recurring/plans/#{plan_id}/cycles/#{cycle_id}/simulate", { amount: amount.to_i })
        end

        # Force attempt for a recurring cycle
        # https://docs.xendit.co/apidocs/force-attempt-recurring-cycle
        def force_attempt_cycle(plan_id:, cycle_id:)
          post("/recurring/plans/#{plan_id}/cycles/#{cycle_id}/force_attempt", {})
        end

        # Get payment details by action_id
        def get_payment(action_id:)
          get("/payments/#{action_id}")
        end

        # Initialize account linking for payment method
        # https://docs.xendit.co/docs/linked-accounts
        def initialize_account_linking(customer_id:, type:, metadata: {})
          payload = {
            customer_id: customer_id,
            type: type,
            metadata: metadata
          }.compact

          post("/linked_accounts/auth", payload)
        end


        private

        def get(path)
          uri = URI("#{BASE_URL}#{path}")
          request = Net::HTTP::Get.new(uri)
          add_headers(request)

          response = make_request(uri, request)
          parse_response(response)
        end

        def post(path, payload = {})
          uri = URI("#{BASE_URL}#{path}")
          request = Net::HTTP::Post.new(uri)
          add_headers(request)
          Rails.logger.info("Xendit API uri path: #{uri}")
          request.body = payload.to_json
          Rails.logger.info("Xendit API request: #{request.body}")

          response = make_request(uri, request)
          Rails.logger.info("Xendit API response: #{response.body}")
          parse_response(response)
        end

        def patch(path, payload = {})
          uri = URI("#{BASE_URL}#{path}")
          request = Net::HTTP::Patch.new(uri)
          add_headers(request)
          request.body = payload.to_json

          response = make_request(uri, request)
          parse_response(response)
        end

        def delete(path)
          uri = URI("#{BASE_URL}#{path}")
          request = Net::HTTP::Delete.new(uri)
          add_headers(request)

          response = make_request(uri, request)
          parse_response(response)
        end

        def add_headers(request)
          request["Authorization"] = "Basic #{Base64.strict_encode64("#{@api_key}:")}"
          request["Content-Type"] = "application/json"
          request["Accept"] = "application/json"
        end

        def make_request(uri, request)
          http = Net::HTTP.new(uri.hostname, uri.port)
          http.use_ssl = true
          http.read_timeout = 30
          http.open_timeout = 10

          http.request(request)

        rescue StandardError => e
          raise Error.new(message: "Xendit API request failed: #{e.message}", status: :error)
        end

        def parse_response(response)
          body = response.body.presence ? JSON.parse(response.body) : {}

          case response
          when Net::HTTPSuccess
            body.deep_symbolize_keys
          when Net::HTTPUnauthorized
            raise Error.from_response(response_body: body, status: 401)
          when Net::HTTPNotFound
            raise Error.from_response(response_body: body, status: 404)
          when Net::HTTPUnprocessableEntity
            raise Error.from_response(response_body: body, status: 422)
          else
            raise Error.from_response(response_body: body, status: response.code.to_i)
          end
        end
      end
    end
  end
end
