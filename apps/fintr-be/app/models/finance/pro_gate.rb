# frozen_string_literal: true

module Finance
  module ProGate
    def self.require!(user_id:, space_id:)
      result = Operations::Entitlements::ResolveProAccess.new.call(
        user_id: user_id&.to_s,
        space_id: space_id.to_s,
      )
      allowed = result.success? && result.value![:pro]
      return Dry::Monads::Failure(subscription: ["Fintr Pro is required"]) unless allowed

      Dry::Monads::Success(true)
    end
  end
end
