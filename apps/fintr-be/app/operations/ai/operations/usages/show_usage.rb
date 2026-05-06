# frozen_string_literal: true

module Ai
  module Operations
    module Usages
      class ShowUsage < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:user_id).value(:string)
          end
        end

        def validate(params)
          result = Contract.new.call(params)
          return Failure(result.errors.to_h) if result.failure?

          Success(params.to_h)
        end

        def call(params)
          params = step validate(params)
          space = step find_space(params)
          user = step find_user(params)
          is_admin = step fetch_is_admin(user:)
          usages = step find_usages(space:, user:)
          usage_period = step fetch_usage_period(space:)
          usage = step show_usage(space:, user:, is_admin:, usages:, usage_period:)

          usage
        end

        private

        def find_space(params)
          Success(Spaces::Space.find(params[:space_id]))
        end

        def find_user(params)
          Success(Auth::User.find(params[:user_id]))
        end

        def fetch_is_admin(user:)
          Success(user.has_role?(:admin))
        end

        def find_usages(space:, user:)
          Ai::Queries::Usages::UsageInPeriod.new.call(params: { space_id: space.id })
        end

        def fetch_usage_period(space:)
          Success(Utils::Recurrence.usage_period(record: space, to_string: true))
        end

        def show_usage(space:, user:, is_admin:, usages:, usage_period:)
          tokens_used = usages.sum(:tokens_used)
          limit = is_admin ? 1_000 : space.current_token_limit
          usage = {
            used: tokens_used,
            limit:,
            remaining: limit - tokens_used,
            usage_period:
          }
          Success(usage)
        end
      end
    end
  end
end
