# frozen_string_literal: true

module Finance
  module Operations
    module ProGrants
      class Acknowledge < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).filled(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          grant = step find_grant(params:)
          step mark_acknowledged(grant:)
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_grant(params:)
          grant = Finance::ProGrant.find_by(user_id: params[:user_id])
          return Failure(pro_grant: ["not found"]) unless grant

          Success(grant)
        end

        def mark_acknowledged(grant:)
          return Success(grant) if grant.acknowledged_at.present?

          grant.update!(acknowledged_at: Time.current)
          Success(grant)
        rescue ActiveRecord::RecordInvalid => e
          Failure(pro_grant: e.record.errors.full_messages)
        end
      end
    end
  end
end
