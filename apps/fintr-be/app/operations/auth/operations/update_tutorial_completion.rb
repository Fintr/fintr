# frozen_string_literal: true

module Auth
  module Operations
    class UpdateTutorialCompletion < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:platform).filled(:string, included_in?: %w[desktop mobile])
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(errors: contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        ActiveRecord::Base.transaction do
          params = step validate(params:)
          user    = step find_user(params:)
          updated_user = step update_tutorial_completion(user:, params:)
          updated_user.reload
        end
      end

      private

      def find_user(params:)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(user_id: "User not found") unless user

        Success(user)
      end

      def update_tutorial_completion(user:, params:)
        field_name = "#{params[:platform]}_tutorial"
        user.update!(field_name => Time.current)
        Success(user)
      rescue ActiveRecord::RecordInvalid => e
        Failure(**user.errors, error: e, expected: true)
      end
    end
  end
end
