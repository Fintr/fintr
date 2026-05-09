# frozen_string_literal: true

module Auth
  module Operations
    class SyncUserFromAuthToken < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user).filled
          required(:auth_id).filled(:string)
          optional(:email).maybe(:string)
          optional(:full_name).maybe(:string)
          optional(:photo_url).maybe(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step apply_token_attributes(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h.deep_symbolize_keys)
      end

      def apply_token_attributes(params:)
        user = params[:user]
        attrs = slice_assignable_token_attrs(params:)
        user.assign_attributes(attrs)
        return Success(user) unless user.changed?

        user.save!
        Success(user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: user.errors, error: e, expected: true)
      end

      def slice_assignable_token_attrs(params:)
        token_keys = Auth::User.clean_attributes
        attrs = params.slice(*token_keys)
        attrs.delete(:full_name) if attrs[:full_name].blank?
        attrs.delete(:email) if attrs[:email].blank?
        attrs
      end
    end
  end
end
