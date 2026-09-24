# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Spaces
  module Operations
    class UpdateSpace < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:name).filled(:string)
          optional(:currency).maybe(:string)
          optional(:default_transaction_currency).maybe(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        validated_params = step validate(params:)

        recalc_space_id = nil
        broadcast_context = nil
        user = nil
        space = transaction do
          user = step find_user(validated_params)
          space = step find_space(validated_params)
          _ = step validate_user_access(user, space)
          update_result = step update_space(space, validated_params)
          recalc_space_id = update_result[:recalc_space_id]
          broadcast_context = update_result[:broadcast_context]

          space.reload
        end

        step enqueue_summary_recalculation(space_id: recalc_space_id)
        step broadcast_currency_change(
          space:,
          user:,
          broadcast_context:,
        )
        space
      end

      private

      def find_user(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(errors: { user: ["not found"] }) unless user

        Success(user)
      end

      def find_space(params)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(errors: { space: ["not found"] }) unless space

        Success(space)
      end

      def validate_user_access(user, space)
        return Failure(errors: { access: ["user does not have access to this space"] }) unless
          user.spaces.include?(space)

        return Failure(errors: { access: ["admin access required"] }) unless
          user.has_role?(:admin, space)

        Success()
      end

      def update_space(space, params)
        previous_currency = space.currency.to_s.upcase
        previous_default = space.default_transaction_currency&.to_s&.upcase
        attrs = { name: params[:name] }
        attrs[:currency] = params[:currency] if params.key?(:currency)
        if params.key?(:default_transaction_currency)
          attrs[:default_transaction_currency] = params[:default_transaction_currency]
        end
        space.update!(attrs)

        recalc_space_id = if params.key?(:currency) &&
                               previous_currency != space.currency.to_s.upcase
                            space.id.to_s
        end

        currency_changed = params.key?(:currency) &&
          previous_currency != space.currency.to_s.upcase
        default_changed = params.key?(:default_transaction_currency) &&
          previous_default != space.default_transaction_currency&.to_s&.upcase
        broadcast_context =
          if currency_changed || default_changed
            {
              currency: space.currency.to_s.upcase,
              default_transaction_currency:
                space.default_transaction_currency&.to_s&.upcase,
            }
          end

        Success(
          recalc_space_id:,
          broadcast_context:,
        )
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: e.record.errors.full_messages, error: e, expected: true)
      end

      def broadcast_currency_change(space:, user:, broadcast_context:)
        return Success(true) if broadcast_context.blank?

        ::Spaces::Broadcasts::SettingsChange.currency_changed(
          space:,
          actor: user,
          currency: broadcast_context[:currency],
          default_transaction_currency:
            broadcast_context[:default_transaction_currency],
        )
        Success(true)
      end

      def enqueue_summary_recalculation(space_id:)
        return Success(true) if space_id.blank?

        MonthlyFinancialSummaries::RecalculateSpaceSummariesJob.perform_later(
          space_id:
        )
        Success(true)
      end
    end
  end
end
