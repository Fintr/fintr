# frozen_string_literal: true

module Api
  module V1
    module Admin
      module Ai
        class AiInteractionsController < ApiController
          before_action :ensure_admin

          def index
            interactions = ::Ai::Interaction.includes(:user, :space)
                                          .recent
                                          .limit(100)

            # Filter by status if provided
            interactions = interactions.where(status: params[:status]) if params[:status].present?

            # Filter by space if provided
            interactions = interactions.where(space_id: params[:space_id]) if params[:space_id].present?

            # Filter by user if provided
            interactions = interactions.where(user_id: params[:user_id]) if params[:user_id].present?

            # Filter by date range if provided
            if params[:start_date].present? && params[:end_date].present?
              start_date = Date.parse(params[:start_date])
              end_date = Date.parse(params[:end_date])
              interactions = interactions.where(created_at: start_date.beginning_of_day..end_date.end_of_day)
            end

            render json: {
              data: interactions.map do |interaction|
                {
                  id: interaction.id,
                  session_id: interaction.session_id,
                  user: {
                    id: interaction.user.id,
                    email: interaction.user.email,
                    name: interaction.user.full_name || interaction.user.email
                  },
                  space: {
                    id: interaction.space.id,
                    name: interaction.space.name,
                    code: interaction.space.code
                  },
                  request: interaction.request,
                  enhanced_prompt: interaction.enhanced_prompt,
                  response: interaction.response,
                  status: interaction.status,
                  error: interaction.error,
                  tokens_used: interaction.tokens_used,
                  time_seconds: interaction.time_seconds,
                  metadata: interaction.metadata,
                  created_at: interaction.created_at,
                  updated_at: interaction.updated_at
                }
              end,
              meta: {
                total_count: interactions.count,
                filters: {
                  status: params[:status],
                  space_id: params[:space_id],
                  user_id: params[:user_id],
                  start_date: params[:start_date],
                  end_date: params[:end_date]
                }
              }
            }
          end

          def show
            interaction = ::Ai::Interaction.includes(:user, :space).find(params[:id])

            render json: {
              data: {
                id: interaction.id,
                session_id: interaction.session_id,
                user: {
                  id: interaction.user.id,
                  email: interaction.user.email,
                  name: interaction.user.full_name || interaction.user.email
                },
                space: {
                  id: interaction.space.id,
                  name: interaction.space.name,
                  code: interaction.space.code
                },
                request: interaction.request,
                enhanced_prompt: interaction.enhanced_prompt,
                response: interaction.response,
                status: interaction.status,
                error: interaction.error,
                tokens_used: interaction.tokens_used,
                time_seconds: interaction.time_seconds,
                metadata: interaction.metadata,
                created_at: interaction.created_at,
                updated_at: interaction.updated_at
              }
            }
          end

          def stats
            # Get basic statistics
            total_interactions = ::Ai::Interaction.count
            successful_interactions = ::Ai::Interaction.successful.count
            failed_interactions = ::Ai::Interaction.failed.count
            total_tokens = ::Ai::Interaction.sum(:tokens_used)
            avg_response_time = ::Ai::Interaction.successful.average(:time_seconds)

            # Get interactions by status
            status_breakdown = ::Ai::Interaction.group(:status).count

            # Get top users by interaction count
            top_users = ::Ai::Interaction.joins(:user)
                                      .group("users.id", "users.email")
                                      .order("COUNT(ai_interactions.id) DESC")
                                      .limit(10)
                                      .count

            # Get top spaces by interaction count
            top_spaces = ::Ai::Interaction.joins(:space)
                                       .group("spaces.id", "spaces.name")
                                       .order("COUNT(ai_interactions.id) DESC")
                                       .limit(10)
                                       .count

            # Get daily interaction counts for the last 30 days
            daily_interactions = ::Ai::Interaction.where(created_at: 30.days.ago..Time.current)
                                              .group("DATE(created_at)")
                                              .count

            render json: {
              data: {
                summary: {
                  total_interactions: total_interactions,
                  successful_interactions: successful_interactions,
                  failed_interactions: failed_interactions,
                  success_rate: total_interactions > 0 ? (successful_interactions.to_f / total_interactions * 100).round(2) : 0,
                  total_tokens: total_tokens,
                  avg_response_time: avg_response_time&.round(2)
                },
                status_breakdown: status_breakdown,
                top_users: top_users.map { |key, count| { user: key[1], count: count } },
                top_spaces: top_spaces.map { |key, count| { space: key[1], count: count } },
                daily_interactions: daily_interactions
              }
            }
          end

          private

          def ensure_admin
            unless current_user.has_role?(:admin)
              render json: { error: "Unauthorized" }, status: :forbidden
            end
          end
        end
      end
    end
  end
end
