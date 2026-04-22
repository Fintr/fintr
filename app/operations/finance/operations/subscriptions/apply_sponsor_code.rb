# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class ApplySponsorCode < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:sponsor_code).value(:string)
            required(:subscription_plan_id).value(:string)
            required(:user_id).value(:string)
          end
        end

        def call(params)
          # Ensure user_id is a string before validation
          params[:user_id] = params[:user_id].to_s if params[:user_id]
          params = step validate(params:)
          sponsor_code = step find_sponsor_code(params:)
          _ = step check_availability(sponsor_code:)
          _ = step check_user_not_already_used(sponsor_code:, params:)
          discount = step calculate_discount(sponsor_code:, params:)

          {
            sponsor_code: sponsor_code,
            discount: discount
          }
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_sponsor_code(params:)
          sponsor_code = Finance::SponsorCode.find_by(code: params[:sponsor_code].upcase)
          return Failure(sponsor_code: "not found") unless sponsor_code

          Success(sponsor_code)
        end

        def check_availability(sponsor_code:)
          return Failure(sponsor_code: "is not active") unless sponsor_code.active?
          return Failure(sponsor_code: "has expired") if sponsor_code.expired?
          return Failure(sponsor_code: "has reached maximum uses") if sponsor_code.at_max_uses?

          Success(true)
        end

        def check_user_not_already_used(sponsor_code:, params:)
          # Verify user exists
          user = Auth::User.find_by(id: params[:user_id])
          return Failure(user_id: "User not found") unless user

          existing_usage = Finance::UserSponsorCode.exists?(
            sponsor_code_id: sponsor_code.id,
            user_id: params[:user_id]
          )
          return Failure(sponsor_code: "has already been used by this user") if existing_usage

          Success(true)
        end

        def calculate_discount(sponsor_code:, params:)
          subscription_plan = Finance::SubscriptionPlan.find_by(id: params[:subscription_plan_id])
          return Failure(subscription_plan_id: "not found") unless subscription_plan

          original_amount = subscription_plan.price_cents
          discount_amount = sponsor_code.calculate_discount(original_amount)
          final_amount = original_amount - discount_amount

          # Calculate promo expiration date if limited duration
          promo_expires_at = nil
          if sponsor_code.limited_duration?
            promo_expires_at = sponsor_code.promo_expiration_date
          end

          Success(
            original_amount_cents: original_amount,
            discount_amount_cents: discount_amount,
            final_amount_cents: final_amount,
            discount_percentage: sponsor_code.percentage_discount? ? sponsor_code.discount_percentage : nil,
            discount_percentage_applied: sponsor_code.percentage_discount? ? sponsor_code.discount_percentage : nil,
            discount_amount_cents_applied: discount_amount,
            discount_months: sponsor_code.discount_months,
            promo_expires_at: promo_expires_at&.iso8601,
            is_limited_duration: sponsor_code.limited_duration?
          )
        end
      end
    end
  end
end
