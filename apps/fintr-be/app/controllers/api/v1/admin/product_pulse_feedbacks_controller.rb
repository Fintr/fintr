# frozen_string_literal: true

module Api
  module V1
    module Admin
      class ProductPulseFeedbacksController < ApiController
        skip_before_action :ensure_space_access!
        before_action :ensure_admin

        def index
          relation = ::ProductPulseFeedback.includes(:user, :space).order(created_at: :desc)
          relation = apply_space_name_filter(relation) if filter_params[:space_name].present?

          if filter_params[:start_date].present? && filter_params[:end_date].present?
            start_date = Date.parse(filter_params[:start_date].to_s)
            end_date = Date.parse(filter_params[:end_date].to_s)
            relation = relation.where(created_at: start_date.beginning_of_day..end_date.end_of_day)
          end

          page = [filter_params[:page].to_i, 1].max
          per_page = [[filter_params[:per_page].to_i, 1].max, 100].min
          per_page = 25 if per_page.zero?

          paginated = relation.page(page).per(per_page)

          render_paginated(
            paginated,
            serializer: ::ProductPulse::Serializers::FeedbackSerializer,
            key: :product_pulse_feedbacks
          )
        end

        private

        def apply_space_name_filter(relation)
          term = filter_params[:space_name].to_s.strip
          return relation if term.blank?

          escaped = ActiveRecord::Base.sanitize_sql_like(term)
          pattern = "%#{escaped}%"

          relation.joins(:space).where("spaces.name ILIKE ?", pattern)
        end

        def filter_params
          p = params.permit(
            :space_name,
            :start_date,
            :end_date,
            :page,
            :per_page
          )
          {
            space_name: p[:space_name].presence,
            start_date: p[:start_date].presence,
            end_date: p[:end_date].presence,
            page: p[:page],
            per_page: p[:per_page].presence
          }
        end

        def ensure_admin
          return if current_user&.has_role?(:admin)

          render_forbidden(message: "Admin access required")
        end
      end
    end
  end
end
