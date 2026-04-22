# frozen_string_literal: true

module Api
  module V1
    module Admin
      module Finance
        class SponsorCodesController < ApiController
          skip_before_action :ensure_space_access!
          before_action :ensure_admin!

          def index
            sponsor_codes = ::Finance::SponsorCode.includes(:created_by, :user_sponsor_codes).order(created_at: :desc)

            serializer = sponsor_codes.map do |code|
              {
                id: code.id,
                code: code.code,
                name: code.name,
                description: code.description,
                discountPercentage: code.discount_percentage,
                discountAmountCents: code.discount_amount_cents,
                maxUses: code.max_uses,
                discountMonths: code.discount_months,
                currentUses: code.current_uses,
                usageCount: code.usage_count,
                active: code.active,
                expiresAt: code.expires_at&.iso8601,
                createdAt: code.created_at.iso8601,
                createdBy: {
                  id: code.created_by.id,
                  email: code.created_by.email
                }
              }
            end

            render_success(data: { sponsor_codes: serializer })
          end

          def show
            sponsor_code = ::Finance::SponsorCode.find(params[:id])

            users_who_used = sponsor_code.user_sponsor_codes.includes(:user, :space_subscription).map do |usage|
              {
                userId: usage.user.id,
                userEmail: usage.user.email,
                spaceSubscriptionId: usage.space_subscription_id,
                discountPercentageApplied: usage.discount_percentage_applied,
                discountAmountCentsApplied: usage.discount_amount_cents_applied,
                createdAt: usage.created_at.iso8601
              }
            end

            render_success(data: {
              sponsor_code: {
                id: sponsor_code.id,
                code: sponsor_code.code,
                name: sponsor_code.name,
                description: sponsor_code.description,
                discountPercentage: sponsor_code.discount_percentage,
                discountAmountCents: sponsor_code.discount_amount_cents,
                maxUses: sponsor_code.max_uses,
                discountMonths: sponsor_code.discount_months,
                currentUses: sponsor_code.current_uses,
                usageCount: sponsor_code.usage_count,
                active: sponsor_code.active,
                expiresAt: sponsor_code.expires_at&.iso8601,
                createdAt: sponsor_code.created_at.iso8601,
                users: users_who_used
              }
            })
          rescue ActiveRecord::RecordNotFound
            render_not_found(details: { sponsor_code: "not found" })
          end

          def create
            sponsor_code = ::Finance::SponsorCode.new(sponsor_code_params)
            sponsor_code.created_by = current_user

            if sponsor_code.save
              render_success(
                data: {
                  sponsor_code: {
                    id: sponsor_code.id,
                    code: sponsor_code.code,
                    name: sponsor_code.name
                  }
                },
                status: :created,
                message: "Sponsor code created successfully"
              )
            else
              render_unprocessable_content(details: { errors: sponsor_code.errors.full_messages })
            end
          end

          def update
            sponsor_code = ::Finance::SponsorCode.find(params[:id])

            if sponsor_code.update(sponsor_code_update_params)
              render_success(
                data: {
                  sponsor_code: {
                    id: sponsor_code.id,
                    code: sponsor_code.code,
                    active: sponsor_code.active
                  }
                },
                message: "Sponsor code updated successfully"
              )
            else
              render_unprocessable_content(details: { errors: sponsor_code.errors.full_messages })
            end
          rescue ActiveRecord::RecordNotFound
            render_not_found(details: { sponsor_code: "not found" })
          end

          def destroy
            sponsor_code = ::Finance::SponsorCode.find(params[:id])
            sponsor_code.destroy!

            render_success(message: "Sponsor code deleted successfully")
          rescue ActiveRecord::RecordNotFound
            render_not_found(details: { sponsor_code: "not found" })
          rescue ActiveRecord::RecordNotDestroyed => e
            render_unprocessable_content(details: { error: e.message })
          end

          private

          def ensure_admin!
            return if current_user.has_role?(:admin)

            render_error(
              message: "Permission denied",
              status: :forbidden
            )
          end

          def sponsor_code_params
            params.permit(
              :code,
              :name,
              :description,
              :discount_percentage,
              :discount_amount_cents,
              :max_uses,
              :discount_months,
              :active,
              :expires_at
            )
          end

          def sponsor_code_update_params
            params.permit(:active)
          end
        end
      end
    end
  end
end
