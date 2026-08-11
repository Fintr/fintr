# frozen_string_literal: true

module InsightsEndpoint
  extend ActiveSupport::Concern

  private

  def insights_index_params
    params.permit(
      :category_name,
      :category_id,
      :subcategory_id,
      :start_date,
      :end_date,
      tag_ids: [],
    )
  end

  def resolve_insights_context
    Insights::Operations::ResolveContext.new.call(
      with_current_params(insights_index_params)
    )
  end

  def render_insights_failure(result)
    render_internal_server_error(details: result.failure)
  end
end
