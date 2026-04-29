# frozen_string_literal: true

module Admin
  module Queries
    class UsersQuery < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          optional(:search_query).maybe(:string)
          optional(:email_query).maybe(:string)
          optional(:name_query).maybe(:string)
          optional(:page)
          optional(:per_page)
        end
      end

      def validate
        contract = Contract.new.call(
          email_query: params[:email_query],
          name_query: params[:name_query],
          page: params[:page],
          per_page: params[:per_page],
          search_query: params[:search_query],
        )
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def initialize(relation: Auth::User.all, params: {})
        super(relation:, params:)
      end

      def call
        params   = step validate
        params   = step apply_defaults(params:)
        relation = step by_query(@relation, params:)
        relation = step paginate(relation, params)
        relation
      end

      private

      def apply_defaults(params:)
        raw_page = params[:page]
        page =
          if raw_page.blank?
            1
          else
            [raw_page.to_i, 1].max
          end

        raw_per = params[:per_page]
        per_page =
          if raw_per.blank?
            25
          else
            [[raw_per.to_i, 1].max, 100].min
          end

        Success(params.merge(page:, per_page:))
      end

      def by_query(relation, params:)
        email_q = params[:email_query].to_s.strip.presence
        name_q  = params[:name_query].to_s.strip.presence
        legacy  = params[:search_query].to_s.strip.presence

        filtered =
          if email_q.present? && name_q.present?
            relation.where(
              "users.email ILIKE :email AND COALESCE(users.full_name, '') ILIKE :name",
              email: "%#{like_escape(email_q)}%",
              name: "%#{like_escape(name_q)}%",
            )
          elsif email_q.present?
            relation.where(
              "users.email ILIKE :email",
              email: "%#{like_escape(email_q)}%",
            )
          elsif name_q.present?
            relation.where(
              "COALESCE(users.full_name, '') ILIKE :name",
              name: "%#{like_escape(name_q)}%",
            )
          elsif legacy.present?
            relation.where(
              "users.email ILIKE :q OR COALESCE(users.full_name, '') ILIKE :q",
              q: "%#{like_escape(legacy)}%",
            )
          else
            relation
          end

        Success(filtered.order(:created_at))
      end

      def like_escape(fragment)
        ActiveRecord::Base.sanitize_sql_like(fragment.to_s)
      end
    end
  end
end
