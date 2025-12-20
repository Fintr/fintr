# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class FindOrCreatePayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_subscription).value(type?: Finance::SpaceSubscription)
            required(:xendit_cycle_id).value(:string)
            optional(:billing_cycle).value(type?: Finance::BillingCycle)
            optional(:attempt_details).array(:hash)
            optional(:action).hash do
              optional(:id).maybe(:string)
              optional(:amount).value(:decimal)
              optional(:currency).maybe(:string)
              optional(:reference_id).maybe(:string)
              optional(:payment_method).hash do
                optional(:id).maybe(:string)
                optional(:type).maybe(:string)
              end
            end
            optional(:cycle).hash do
              optional(:id).maybe(:string)
              optional(:reference_id).maybe(:string)
            end
            optional(:amount).value(:decimal)
            optional(:currency).maybe(:string)
            optional(:reference_id).maybe(:string)
            optional(:cycle_id).maybe(:string)
            optional(:id).maybe(:string)
            optional(:payment_method_id).maybe(:string)
            optional(:payment_method_type).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          space_subscription  = step find_space_subscription(params:)
          billing_cycle       = params[:billing_cycle]
          xendit_cycle_id     = params[:xendit_cycle_id]
          payment             = step find_or_initialize_payment(
                                      space_subscription:,
                                      xendit_cycle_id:,
                                      billing_cycle:
                                    )
          _                   = step assign_payment_attributes(payment:, space_subscription:, billing_cycle:, params:) if payment.new_record?
          _                   = step update_payment_billing_cycle(payment:, billing_cycle:) if billing_cycle.present? && payment.persisted?
          _                   = step save_payment(payment:)

          payment
        end

        private

        def find_space_subscription(params:)
          Success(params[:space_subscription])
        end


        def find_or_initialize_payment(space_subscription:, xendit_cycle_id:, billing_cycle:)
          payment = Finance::Payment.find_or_initialize_by(
            xendit_cycle_id: xendit_cycle_id
          )
          Success(payment)
        end

        def assign_payment_attributes(payment:, space_subscription:, billing_cycle:, params:)
          # Extract amount from flat structure, nested action, or use plan price
          amount_cents = if params[:amount].present?
                           (params[:amount] * 100).to_i
          elsif params.dig(:action, :amount).present?
                           (params.dig(:action, :amount) * 100).to_i
          else
                           space_subscription.subscription_plan.price_cents
          end

          # Extract currency from flat structure, nested action, or default to PHP
          currency = params[:currency] ||
                    params.dig(:action, :currency) ||
                    "PHP"

          # Extract reference_id from params
          reference_id = params[:reference_id]

          # Extract cycle ID from flat structure or nested structure
          cycle_id = params[:id] || # Cycle ID in flat structure
                    params.dig(:cycle, :id) ||
                    params[:cycle_id]

          payment.assign_attributes(
            space_subscription: space_subscription,
            billing_cycle: billing_cycle,
            xendit_cycle_id: cycle_id,
            xendit_reference_id: reference_id,
            amount_cents: amount_cents,
            amount_currency: currency,
            status: "pending",
            payment_method_type: params.dig(:action, :payment_method, :type) || params[:payment_method_type],
            payment_method_id: params.dig(:action, :payment_method, :id) || params[:payment_method_id],
            xendit_data: params.deep_stringify_keys,
            metadata: {}
          )

          Success(payment)
        end

        def update_payment_billing_cycle(payment:, billing_cycle:)
          return Success(payment) if payment.billing_cycle_id == billing_cycle.id

          payment.update!(billing_cycle: billing_cycle)
          Success(payment)
        end

        def save_payment(payment:)
          payment.save!
          Success(payment)
        rescue ActiveRecord::RecordInvalid => e
          Failure(payment: e.record.errors.full_messages)
        end
      end
    end
  end
end
