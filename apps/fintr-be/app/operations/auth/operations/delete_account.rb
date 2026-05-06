# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Auth
  module Operations
    class DeleteAccount < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord

      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        validated_params = step validate(params:)

        transaction do
          user = step find_user(params: validated_params)
          _ = step delete_user_spaces(user:)
          _ = step delete_user_from_auth0(user:)
          _ = step delete_user_record(user:)

          { message: "Account deleted successfully" }
        end
      end

      private

      def find_user(params:)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(user: ["not found"]) unless user

        Success(user)
      end

      def delete_user_spaces(user:)
        personal_space_ids = user.personal_spaces.pluck(:id)

        personal_space_ids.each do |space_id|
          delete_space_completely(space_id:, user:)
        end

        # Remove user from organization spaces (don't delete the spaces themselves)
        Spaces::SpaceUser.where(user_id: user.id).where.not(space_id: personal_space_ids).delete_all

        Success()
      rescue StandardError => e
        Rails.logger.error "[DeleteAccount] Failed to delete user spaces: #{e.message}"
        Failure(error: "Failed to delete user spaces: #{e.message}")
      end

      def delete_space_completely(space_id:, user:)
        space = Spaces::Space.find_by(id: space_id)
        return unless space

        # Reuse ResetData to delete the bulk of space data (transactions, budgets,
        # loans, categories, accounts, imports, conversations, etc.). Rows are
        # destroyed directly; running balances are not adjusted via ConvertSignedAmount.
        Spaces::Operations::ResetData.new.call(space_id: space_id, user_id: user.id)

        space.reload

        # Delete data not handled by ResetData
        space.tickets.destroy_all
        space.space_subscriptions.destroy_all
        space.entities.destroy_all
        Ai::Usage.where(space_id: space_id).delete_all
        Ai::Interaction.where(space_id: space_id).delete_all
        Ai::RagEmbedding.where(space_id: space_id).delete_all
        MonthlyFinancialSummary.where(space_id: space_id).delete_all

        # Delete roles and space membership
        Auth::Role.where(resource_id: space_id).destroy_all
        Spaces::SpaceUser.where(space_id: space_id).delete_all

        # Finally delete the space itself
        space.destroy
      end

      def delete_user_from_auth0(user:)
        return Success() if user.auth_id.blank?

        Auth::M2mClient.client.delete_user(user.auth_id)
        Rails.logger.info "[DeleteAccount] Successfully deleted user #{user.auth_id} from Auth0"
        Success()
      rescue Auth0::Unauthorized => e
        Rails.logger.warn "[DeleteAccount] Auth0 Unauthorized error, resetting M2M client: #{e.message}"
        Sentry.capture_exception(e)
        Auth::M2mClient.reset!

        begin
          Auth::M2mClient.client.delete_user(user.auth_id)
          Success()
        rescue StandardError => retry_error
          Rails.logger.warn "[DeleteAccount] Auth0 retry failed (non-blocking): #{retry_error.message}"
          Sentry.capture_exception(retry_error)
          Success()
        end
      rescue Auth0::NotFound => e
        Rails.logger.info "[DeleteAccount] User #{user.auth_id} not found in Auth0, continuing deletion"
        Sentry.capture_exception(e)
        Success()
      rescue Auth0::AccessDenied => e
        Rails.logger.warn "[DeleteAccount] Auth0 AccessDenied (insufficient scope), continuing with local deletion: #{e.message}"
        Sentry.capture_exception(e)
        Success()
      end

      def delete_user_record(user:)
        # Clean up user roles (HABTM join table)
        user.roles.clear

        Onboarding.where(user_id: user.id).delete_all
        UserActivity.where(user_id: user.id).delete_all
        Spaces::SpaceUser.where(user_id: user.id).delete_all

        # CRM tickets owned by user (if any remain from org spaces)
        ticket_ids = Crm::Ticket.where(user_id: user.id).pluck(:id)
        Crm::TicketResponse.where(ticket_id: ticket_ids).delete_all
        Crm::Ticket.where(user_id: user.id).delete_all

        # Finally delete the user
        user.delete

        Success()
      rescue ActiveRecord::ActiveRecordError => e
        Rails.logger.error "[DeleteAccount] Failed to delete user: #{e.message}"
        Failure(error: "Failed to delete user: #{e.message}")
      end
    end
  end
end
