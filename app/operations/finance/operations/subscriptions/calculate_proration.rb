# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class CalculateProration < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:current_subscription).value(type?: Finance::SpaceSubscription)
            required(:new_plan).value(type?: Finance::SubscriptionPlan)
            optional(:effective_date).maybe(:date_time)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params = step validate(params:)
          same_plan_check = step check_same_plan(params:)
          return same_plan_check if same_plan_check[:no_proration]

          current_cycle_result = step get_current_cycle(params:)
          return current_cycle_result if current_cycle_result[:no_proration]

          plan_comparison = step compare_plans(params:, current_cycle: current_cycle_result)
          cycle_dates = step calculate_cycle_dates(params:, current_cycle: current_cycle_result)
          days_calculation = step calculate_days(cycle_dates:)
          daily_rates = step calculate_daily_rates(params:, days_calculation:)
          prorated_amount = step calculate_prorated_amount(daily_rates:, days_calculation:)
          result = step build_result(
            params:,
            plan_comparison:,
            cycle_dates:,
            days_calculation:,
            daily_rates:,
            prorated_amount:,
            current_cycle: current_cycle_result
          )

          result
        end

        private

        def check_same_plan(params:)
          current_subscription = params[:current_subscription]
          new_plan = params[:new_plan]

          if current_subscription.subscription_plan_id == new_plan.id
            Success({
              no_proration: true,
              action: nil,
              same_plan: true
            })
          else
            Success({ no_proration: false })
          end
        rescue StandardError => e
          Failure(error: "Failed to check same plan: #{e.message}")
        end

        def get_current_cycle(params:)
          current_subscription = params[:current_subscription]
          current_cycle = current_subscription.current_paid_cycle

          unless current_cycle
            return Success({
              no_proration: true,
              action: nil,
              no_current_cycle: true
            })
          end

          Success({ no_proration: false, current_cycle: current_cycle })
        rescue StandardError => e
          Failure(error: "Failed to get current cycle: #{e.message}")
        end

        def compare_plans(params:, current_cycle:)
          current_subscription = params[:current_subscription]
          new_plan = params[:new_plan]

          if new_plan.price_cents > current_subscription.subscription_plan.price_cents
            action = "upgrade"
          elsif new_plan.price_cents < current_subscription.subscription_plan.price_cents
            action = "downgrade"
          else
            action = nil
          end

          Success({
            action: action
          })
        rescue StandardError => e
          Failure(error: "Failed to compare plans: #{e.message}")
        end

        def calculate_cycle_dates(params:, current_cycle:)
          cycle = current_cycle[:current_cycle]
          effective_date = params[:effective_date] || Time.zone.now

          cycle_start = cycle.started_at
          cycle_end = cycle.ends_at

          # Ensure effective_date is within cycle bounds
          effective_date = [effective_date, cycle_end].min
          effective_date = [effective_date, cycle_start].max

          Success({
            cycle_start: cycle_start,
            cycle_end: cycle_end,
            effective_date: effective_date
          })
        rescue StandardError => e
          Failure(error: "Failed to calculate cycle dates: #{e.message}")
        end

        def calculate_days(cycle_dates:)
          cycle_start = cycle_dates[:cycle_start]
          cycle_end = cycle_dates[:cycle_end]
          effective_date = cycle_dates[:effective_date]

          days_elapsed = (effective_date.to_date - cycle_start.to_date).to_i
          total_days = (cycle_end.to_date - cycle_start.to_date).to_i + 1 # +1 to include both start and end days
          days_remaining = total_days - days_elapsed

          Success({
            days_elapsed: days_elapsed,
            total_days: total_days,
            days_remaining: days_remaining
          })
        rescue StandardError => e
          Failure(error: "Failed to calculate days: #{e.message}")
        end

        def calculate_daily_rates(params:, days_calculation:)
          current_subscription = params[:current_subscription]
          new_plan = params[:new_plan]
          total_days = days_calculation[:total_days]

          old_daily_rate = current_subscription.subscription_plan.price_cents.to_f / total_days
          new_daily_rate = new_plan.price_cents.to_f / total_days

          Success({
            old_daily_rate: old_daily_rate,
            new_daily_rate: new_daily_rate
          })
        rescue StandardError => e
          Failure(error: "Failed to calculate daily rates: #{e.message}")
        end

        def calculate_prorated_amount(daily_rates:, days_calculation:)
          old_daily_rate = daily_rates[:old_daily_rate]
          new_daily_rate = daily_rates[:new_daily_rate]
          days_remaining = days_calculation[:days_remaining]

          # Calculate prorated amount
          # For upgrades: positive amount (charge user)
          # For downgrades: negative amount (credit user, applied to next cycle)
          prorated_amount_cents = (new_daily_rate - old_daily_rate) * days_remaining

          Success({
            prorated_amount_cents: prorated_amount_cents.round
          })
        rescue StandardError => e
          Failure(error: "Failed to calculate prorated amount: #{e.message}")
        end

        def build_result(params:, plan_comparison:, cycle_dates:, days_calculation:, daily_rates:, prorated_amount:, current_cycle:)
          current_subscription = params[:current_subscription]
          new_plan = params[:new_plan]

          Success({
            no_proration: false,
            action: plan_comparison[:action],
            days_elapsed: days_calculation[:days_elapsed],
            days_remaining: days_calculation[:days_remaining],
            total_days: days_calculation[:total_days],
            prorated_amount_cents: prorated_amount[:prorated_amount_cents],
            old_plan: current_subscription.subscription_plan,
            new_plan: new_plan,
            current_cycle: current_cycle[:current_cycle],
            effective_date: cycle_dates[:effective_date],
            old_daily_rate: daily_rates[:old_daily_rate],
            new_daily_rate: daily_rates[:new_daily_rate]
          })
        rescue StandardError => e
          Failure(error: "Failed to build result: #{e.message}")
        end
      end
    end
  end
end
