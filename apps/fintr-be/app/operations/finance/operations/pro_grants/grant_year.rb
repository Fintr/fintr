# frozen_string_literal: true

module Finance
  module Operations
    module ProGrants
      class GrantYear < Dry::Operation
        DURATION = 1.year

        class Contract < Dry::Validation::Contract
          params do
            required(:email).filled(:string)
            required(:granted_by_id).filled(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          recipient = step find_recipient(params:)
          step persist_grant(params:, recipient:)
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_recipient(params:)
          email = Auth::User.normalize_email_for_lookup(params[:email])
          recipient = Auth::User.find_by(email:)
          return Failure(email: ["No account uses that email"]) unless recipient

          Success(recipient)
        end

        def persist_grant(params:, recipient:)
          grant = Finance::ProGrant.find_or_initialize_by(user_id: recipient.id)
          grant.assign_attributes(
            granted_by_id: params[:granted_by_id],
            expires_at: DURATION.from_now,
            acknowledged_at: nil,
          )
          grant.save!
          Success(grant)
        rescue ActiveRecord::RecordInvalid => e
          Failure(pro_grant: e.record.errors.full_messages)
        end
      end
    end
  end
end
