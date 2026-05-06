# frozen_string_literal: true

module Auth
  module Operations
    class ResetPassword < Dry::Operation
      def initialize(auth0_client: Auth::M2mClient.client)
        @auth0_client = auth0_client
      end

      class Contract < Dry::Validation::Contract
        params do
          required(:email).filled(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(errors: contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params    = step validate(params:)
        user      = step find_user(params:)
        _         = step reset_password(user:, params:)
        message
      end

      def find_user(params:)
        Success(Auth::User.find_by!(email: params[:email]))
      rescue ActiveRecord::RecordNotFound
        Failure(email: "User not found")
      end

      def reset_password(user:, params:)
        email = user.email
        response = @auth0_client.reset_password(email)
        Success(response)
      rescue StandardError => e
        Failure(errors: e.message)
      end
    end
  end
end
