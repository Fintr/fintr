# frozen_string_literal: true

module Auth
  module Operations
    # Resolves the current session user from token claims without running full provisioning on every request.
    # Calls {CreateUserAndSpace} only when the user is missing or still needs a personal space / roles / Brevo sync.
    class EnsureAuthenticatedUser < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:auth_id).filled(:string)
          optional(:email).maybe(:string)
          optional(:full_name).maybe(:string)
          optional(:photo_url).maybe(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step ensure_user(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h.deep_symbolize_keys)
      end

      def ensure_user(params:)
        match = Auth::User.find_for_token(
          auth_id: params[:auth_id],
          email: params[:email]
        )

        return CreateUserAndSpace.new.call(params) if match[:user].nil?

        if match[:matched_by] == :email
          return Success(match[:user]) if match[:user].personal_spaces.exists?

          return CreateUserAndSpace.new.call(params)
        end

        return CreateUserAndSpace.new.call(params) unless match[:user].personal_spaces.exists?

        SyncUserFromAuthToken.new.call(params.merge(user: match[:user]))
      end
    end
  end
end
